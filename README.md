# Tutor

A local study harness: a PDF reader with a page-aware AI tutor in the sidebar.
Upload a book or lecture notes, navigate to the page you're on, and ask
questions — the tutor sees that page (plus the surrounding ones) and answers
with full conversation memory. Math answers render with LaTeX.

## Stack

- **Python / FastAPI** — app + API
- **PyMuPDF** — server-side page rendering (what the model "sees")
- **LangGraph** — agent graph, threads persisted via a SQLite checkpointer
- **OpenRouter** — LLM access (any multimodal chat model)
- **Vanilla JS** — pdf.js viewer + KaTeX math rendering, no build step
- **SQLite** — documents, threads, settings, checkpoints

## Requirements

- [uv](https://docs.astral.sh/uv/)
- An [OpenRouter](https://openrouter.ai) API key

## Setup

```sh
cp .env.example .env      # add your OPENROUTER_API_KEY
uv sync
uv run tutor --reload     # or: uv run tutor [--host H] [--port P]
```

Then open http://127.0.0.1:8000, upload a PDF, and start a conversation.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `OPENROUTER_API_KEY` | (required for chat) | OpenRouter key |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4.5` | Default model (switchable in the UI) |
| `OPENROUTER_EFFORT` | `medium` | Reasoning effort: `none`/`low`/`medium`/`high` |
| `TUTOR_CONTEXT_PAGES` | `1` | Neighbouring pages sent as context (±N) |

Model and effort can also be switched per session from the reader's sidebar;
the choice is stored in SQLite and used from the next message on.

## How it works

- Each question renders the current page (and ±N neighbours) to PNG on the
  server and sends them as images alongside your question to the model.
- The full message history of the thread is replayed from the LangGraph
  SQLite checkpointer, so the tutor remembers prior pages and questions.
- Thread switching ("New" in the sidebar) starts a fresh context.
- Answers stream in over SSE and render as Markdown + LaTeX (`$…$`, `$$…$$`).

## Reader

- Continuous, Chrome-style scrolling with only visible pages rendered
- Zoom: toolbar `+`/`−` buttons or `Ctrl` + mouse wheel; starts fit-to-width
- `←` / `→` (or `PageUp` / `PageDown`) — jump previous / next page
- `Enter` — send message · `Shift+Enter` — newline in chat
- The tutor automatically sees the page you're currently scrolled to

## Development

```sh
uv run pytest          # tests
uv run ruff check src tests
uv run mypy src/tutor
```
