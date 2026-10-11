import sqlite3
import uuid
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def new_id() -> str:
    return uuid.uuid4().hex


def add_document(
    db_path: Path, title: str, filename: str, page_count: int, doc_id: str | None = None
) -> dict:
    conn = connect(db_path)
    doc_id = doc_id or new_id()
    conn.execute(
        "INSERT INTO documents (id, title, filename, page_count) VALUES (?, ?, ?, ?)",
        (doc_id, title, filename, page_count),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    return dict(row)


def list_documents(db_path: Path) -> list[dict]:
    conn = connect(db_path)
    rows = conn.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_document(db_path: Path, doc_id: str) -> dict | None:
    conn = connect(db_path)
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def add_thread(db_path: Path, document_id: str, title: str) -> dict:
    conn = connect(db_path)
    thread_id = new_id()
    conn.execute(
        "INSERT INTO threads (id, document_id, title) VALUES (?, ?, ?)",
        (thread_id, document_id, title),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM threads WHERE id = ?", (thread_id,)).fetchone()
    conn.close()
    return dict(row)


def list_threads(db_path: Path, document_id: str) -> list[dict]:
    conn = connect(db_path)
    rows = conn.execute(
        "SELECT * FROM threads WHERE document_id = ? ORDER BY created_at DESC",
        (document_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_thread(db_path: Path, thread_id: str) -> dict | None:
    conn = connect(db_path)
    row = conn.execute("SELECT * FROM threads WHERE id = ?", (thread_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_setting(db_path: Path, key: str, default: str) -> str:
    conn = connect(db_path)
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def set_setting(db_path: Path, key: str, value: str) -> None:
    conn = connect(db_path)
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    conn.commit()
    conn.close()
