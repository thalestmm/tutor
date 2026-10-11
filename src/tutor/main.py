from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from tutor import db
from tutor.agent import (
    ModelConfig,
    build_graph,
    build_model,
)
from tutor.config import BASE_DIR, load_settings
from tutor.routes import chat, documents

FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

SPA_NOT_BUILT = """<!DOCTYPE html>
<html><body style="font-family: system-ui; background: #14161a; color: #e6e8ec;
padding: 3rem; max-width: 640px; margin: 0 auto;">
<h1>Tutor</h1>
<p>The frontend is not built yet. Run:</p>
<pre><code>cd frontend &amp;&amp; npm install &amp;&amp; npm run build</code></pre>
<p>For development with hot reload:</p>
<pre><code>uv run tutor --reload        # backend on :8000
cd frontend &amp;&amp; npm run dev  # frontend on :5173</code></pre>
</body></html>"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings(app.state.data_dir if hasattr(app.state, "data_dir") else None)
    settings.ensure_dirs()
    db.connect(settings.db_path).close()
    async with AsyncSqliteSaver.from_conn_string(str(settings.checkpoint_path)) as saver:
        model = build_model(
            ModelConfig(
                model=settings.openrouter_model,
                api_key=settings.openrouter_api_key,
                effort=settings.openrouter_effort,
            )
        )
        app.state.settings = settings
        app.state.checkpointer = saver
        app.state.graph = build_graph(model, saver)
        app.state.graph_key = (settings.openrouter_model, settings.openrouter_effort)
        yield


def create_app(data_dir: Path | None = None) -> FastAPI:
    app = FastAPI(title="Tutor", lifespan=lifespan)
    if data_dir is not None:
        app.state.data_dir = data_dir
    app.include_router(documents.router)
    app.include_router(chat.router)

    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    index = FRONTEND_DIST / "index.html"

    @app.get("/", include_in_schema=False)
    async def spa_root():
        return _spa(index)

    @app.get("/{rest:path}", include_in_schema=False)
    async def spa_fallback(rest: str, request: Request):
        return _spa(index)

    return app


def _spa(index: Path):
    if index.is_file():
        # The SPA shell must never be cached: each build emits new hashed asset
        # filenames and deletes the old ones, so a stale index.html would point
        # at missing bundles.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
    return HTMLResponse(SPA_NOT_BUILT, status_code=503)


app = create_app()
