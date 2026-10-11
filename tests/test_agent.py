import asyncio
from pathlib import Path

import pymupdf
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from tutor.agent import build_graph


def make_pdf_bytes(pages: int = 2) -> bytes:
    path = Path("/tmp/opencode/_test_make.pdf")
    doc = pymupdf.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"Page {i + 1}")
    doc.save(path)
    doc.close()
    return path.read_bytes()


def test_graph_persists_thread_history(tmp_path):
    async def run():
        async with AsyncSqliteSaver.from_conn_string(str(tmp_path / "cp.db")) as saver:
            model = GenericFakeChatModel(messages=iter(["answer one", "answer two"]))
            graph = build_graph(model, saver)
            config = {"configurable": {"thread_id": "t1"}}
            await graph.ainvoke({"messages": ["question 1"]}, config)
            await graph.ainvoke({"messages": ["question 2"]}, config)
            state = await graph.aget_state(config)
        return state.values["messages"]

    messages = asyncio.run(run())
    assert [m.type for m in messages] == ["human", "ai", "human", "ai"]
    assert messages[1].content == "answer one"
    assert messages[3].content == "answer two"
