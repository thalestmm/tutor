import base64
import json
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from tutor import db, pdf
from tutor.agent import ModelConfig, build_graph, build_model

router = APIRouter(prefix="/api")


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


class ThreadIn(BaseModel):
    document_id: str
    title: str | None = None


@router.post("/threads")
async def create_thread(body: ThreadIn, request: Request):
    settings = request.app.state.settings
    doc = db.get_document(settings.db_path, body.document_id)
    if doc is None:
        return {"error": "document not found"}
    thread = db.add_thread(settings.db_path, body.document_id, body.title or doc["title"])
    return thread


@router.get("/threads")
async def list_threads(document_id: str, request: Request):
    return db.list_threads(request.app.state.settings.db_path, document_id)


def _content_to_text(content) -> str:
    if isinstance(content, str):
        return content
    parts = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "\n".join(parts)


@router.get("/threads/{thread_id}/messages")
async def get_messages(thread_id: str, request: Request):
    graph = request.app.state.graph
    state = await graph.aget_state({"configurable": {"thread_id": thread_id}})
    messages = []
    for msg in state.values.get("messages", []):
        messages.append({"role": msg.type, "content": _content_to_text(msg.content)})
    return messages


class AskIn(BaseModel):
    page: int
    text: str


@router.post("/threads/{thread_id}/messages")
async def ask(thread_id: str, body: AskIn, request: Request):
    settings = request.app.state.settings
    thread = db.get_thread(settings.db_path, thread_id)
    if thread is None:
        return {"error": "thread not found"}
    doc = db.get_document(settings.db_path, thread["document_id"])
    if doc is None:
        return {"error": "document not found"}
    if not (1 <= body.page <= doc["page_count"]):
        return {"error": "page out of range"}

    first = max(1, body.page - settings.context_pages)
    last = min(doc["page_count"], body.page + settings.context_pages)
    blocks: list[str | dict[Any, Any]] = []
    path = settings.uploads_dir / f"{doc['id']}.pdf"
    for p in range(first, last + 1):
        png = pdf.render_page_png(path, p)
        label = f"Page {p} (current page)" if p == body.page else f"Page {p} (context)"
        blocks.append({"type": "text", "text": label})
        blocks.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{base64.b64encode(png).decode()}"},
            }
        )
    blocks.append(
        {
            "type": "text",
            "text": f"The user is on page {body.page} of a {doc['page_count']}-page document.\n\n"
            f"Question: {body.text}",
        }
    )
    human = HumanMessage(content=blocks)

    cfg = ModelConfig(
        model=db.get_setting(settings.db_path, "openrouter_model", settings.openrouter_model),
        api_key=settings.openrouter_api_key,
        effort=db.get_setting(settings.db_path, "openrouter_effort", settings.openrouter_effort),
    )
    graph = request.app.state.graph
    if graph is None or request.app.state.graph_key != (cfg.model, cfg.effort):
        model = build_model(cfg)
        graph = build_graph(model, request.app.state.checkpointer)
        request.app.state.graph = graph
        request.app.state.graph_key = (cfg.model, cfg.effort)
    config = {"configurable": {"thread_id": thread_id}}

    async def gen():
        yield _sse({"type": "start"})
        try:
            async for chunk, meta in graph.astream(
                {"messages": [human]}, config, stream_mode="messages"
            ):
                if meta.get("langgraph_node") != "respond":
                    continue
                text = chunk.text if hasattr(chunk, "text") else ""
                if text:
                    yield _sse({"type": "token", "value": text})
        except Exception as exc:
            yield _sse({"type": "error", "value": f"{type(exc).__name__}: {exc}"})
        yield _sse({"type": "done"})

    return StreamingResponse(gen(), media_type="text/event-stream")


class SettingsIn(BaseModel):
    openrouter_model: str | None = None
    openrouter_effort: str | None = None


@router.post("/settings")
async def update_settings(body: SettingsIn, request: Request):
    settings = request.app.state.settings
    if body.openrouter_model:
        db.set_setting(settings.db_path, "openrouter_model", body.openrouter_model)
    if body.openrouter_effort:
        db.set_setting(settings.db_path, "openrouter_effort", body.openrouter_effort)
    request.app.state.graph_key = None
    return {"openrouter_model": body.openrouter_model, "openrouter_effort": body.openrouter_effort}


@router.get("/settings")
async def read_settings(request: Request):
    settings = request.app.state.settings
    return {
        "openrouter_model": db.get_setting(
            settings.db_path, "openrouter_model", settings.openrouter_model
        ),
        "openrouter_effort": db.get_setting(
            settings.db_path, "openrouter_effort", settings.openrouter_effort
        ),
        "api_key_configured": bool(settings.openrouter_api_key),
    }
