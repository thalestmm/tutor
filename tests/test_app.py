import io

import pymupdf
from fastapi.testclient import TestClient

from tutor.main import create_app


def make_pdf_bytes(pages: int = 3) -> bytes:
    doc = pymupdf.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"Page {i + 1}")
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def upload(client: TestClient, tmp_path, pages: int = 3, name: str = "book.pdf") -> dict:
    res = client.post(
        "/api/documents",
        files={"file": (name, make_pdf_bytes(pages), "application/pdf")},
        data={"title": "My Book"},
    )
    assert res.status_code == 200
    return res.json()


def make_client(tmp_path):
    app = create_app(data_dir=tmp_path)
    return TestClient(app)


def test_upload_and_pdf_assets(tmp_path):
    client = make_client(tmp_path)
    with client:
        doc = upload(client, tmp_path)
        assert doc["title"] == "My Book"
        assert doc["page_count"] == 3

        res = client.get(f"/api/documents/{doc['id']}/pdf")
        assert res.status_code == 200
        assert res.content[:5] == b"%PDF-"

        res = client.get(f"/api/documents/{doc['id']}/pages/2.png")
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"


def test_list_and_get_documents(tmp_path):
    client = make_client(tmp_path)
    with client:
        assert client.get("/api/documents").json() == []
        doc = upload(client, tmp_path)
        listed = client.get("/api/documents").json()
        assert [d["id"] for d in listed] == [doc["id"]]
        assert client.get(f"/api/documents/{doc['id']}").json()["page_count"] == 3
        assert client.get("/api/documents/missing").status_code == 404


def test_upload_rejects_non_pdf(tmp_path):
    client = make_client(tmp_path)
    with client:
        res = client.post(
            "/api/documents",
            files={"file": ("book.txt", b"hello", "text/plain")},
            data={"title": ""},
        )
        assert res.status_code == 400


def test_page_image_out_of_range_404(tmp_path):
    client = make_client(tmp_path)
    with client:
        doc = upload(client, tmp_path)
        assert client.get(f"/api/documents/{doc['id']}/pages/99.png").status_code == 404


def test_threads_api(tmp_path):
    client = make_client(tmp_path)
    with client:
        doc = upload(client, tmp_path)

        res = client.post("/api/threads", json={"document_id": doc["id"]})
        assert res.status_code == 200
        thread_id = res.json()["id"]

        res = client.get(f"/api/threads?document_id={doc['id']}")
        assert [t["id"] for t in res.json()] == [thread_id]

        res = client.get(f"/api/threads/{thread_id}/messages")
        assert res.json() == []


def test_settings_api(tmp_path):
    client = make_client(tmp_path)
    with client:
        res = client.post("/api/settings", json={"openrouter_effort": "high"})
        assert res.status_code == 200

        res = client.get("/api/settings")
        assert res.json()["openrouter_effort"] == "high"
