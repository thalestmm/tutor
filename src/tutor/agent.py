from dataclasses import dataclass

from langchain_core.messages import AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, MessagesState, StateGraph
from pydantic import SecretStr

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

SYSTEM_PROMPT = """\
You are Tutor, a patient and precise study assistant. The user is reading a \
document and asks questions about the page they are currently viewing. You are \
given images of the current page and, when available, the surrounding pages \
for context.

Guidelines:
- Ground your answers in the provided pages. If the answer is not on them, say \
so and answer from general knowledge, clearly marking the distinction.
- Reference specific page numbers, sections, equations, or figures when helpful.
- Use LaTeX for all math: inline math in $...$ and display math in $$...$$.
- Prefer concise explanations, worked steps, and concrete examples over vague prose.
- If the user asks for practice, generate exercises at the level of the material shown.
"""


@dataclass
class ModelConfig:
    model: str
    api_key: str
    effort: str


def build_model(cfg: ModelConfig) -> ChatOpenAI:
    extra_body = {}
    if cfg.effort and cfg.effort != "none":
        extra_body["reasoning"] = {"effort": cfg.effort}
    return ChatOpenAI(
        model=cfg.model,
        api_key=SecretStr(cfg.api_key or "not-configured"),
        base_url=OPENROUTER_BASE_URL,
        streaming=True,
        extra_body=extra_body,
    )


def build_graph(model, checkpointer: BaseCheckpointSaver):
    async def respond(state: MessagesState):
        response = await model.ainvoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
        return {"messages": [AIMessage(content=response.content)]}

    builder = StateGraph(MessagesState)
    builder.add_node("respond", respond)
    builder.add_edge(START, "respond")
    builder.add_edge("respond", END)
    return builder.compile(checkpointer=checkpointer)
