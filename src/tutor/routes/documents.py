from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response

from tutor import db, pdf

router = APIRouter(prefix="/api")

MAX_PDF_BYTES = 200 * 1024 * 1024


def _upload_path(request: Request, doc_id: str) -> Path:
    return request.app.state.settings.uploads_dir / f"{doc_id}.pdf"


@router.post("/documents")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(None),
) -> dict:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    settings = request.app.state.settings
    doc_id = db.new_id()
    dest = _upload_path(request, doc_id)
    size = 0
    with dest.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_PDF_BYTES:
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File is too large (max 200 MB)")
            out.write(chunk)
    try:
        pages = pdf.page_count(dest)
    except Exception:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="That file is not a valid PDF") from None
    doc = db.add_document(
        settings.db_path,
        title or file.filename or "Untitled",
        file.filename or "",
        pages,
        doc_id=doc_id,
    )
    return {"id": doc["id"], "title": doc["title"], "page_count": doc["page_count"]}


@router.get("/documents")
async def list_documents(request: Request) -> list[dict]:
    return db.list_documents(request.app.state.settings.db_path)


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, request: Request) -> dict:
    doc = db.get_document(request.app.state.settings.db_path, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/documents/{doc_id}/pdf")
async def get_pdf(doc_id: str, request: Request):
    return FileResponse(_upload_path(request, doc_id), media_type="application/pdf")


@router.get("/documents/{doc_id}/pages/{page_number}.png")
async def get_page_image(doc_id: str, page_number: int, request: Request):
    doc = db.get_document(request.app.state.settings.db_path, doc_id)
    if doc is None or page_number < 1 or page_number > doc["page_count"]:
        raise HTTPException(status_code=404, detail="Page not found")
    path = _upload_path(request, doc_id)
    png = pdf.render_page_png(path, page_number)
    return Response(content=png, media_type="image/png")
