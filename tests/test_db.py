from tutor import db


def test_document_roundtrip(tmp_path):
    db_path = tmp_path / "tutor.db"
    doc = db.add_document(db_path, "Test Book", "book.pdf", 10)
    assert db.get_document(db_path, doc["id"])["title"] == "Test Book"
    assert len(db.list_documents(db_path)) == 1
    assert db.get_document(db_path, "missing") is None


def test_thread_roundtrip(tmp_path):
    db_path = tmp_path / "tutor.db"
    doc = db.add_document(db_path, "Test Book", "book.pdf", 10)
    thread = db.add_thread(db_path, doc["id"], "Test Book")
    assert db.get_thread(db_path, thread["id"])["document_id"] == doc["id"]
    assert db.list_threads(db_path, doc["id"])[0]["id"] == thread["id"]


def test_settings_roundtrip(tmp_path):
    db_path = tmp_path / "tutor.db"
    assert db.get_setting(db_path, "k", "default") == "default"
    db.set_setting(db_path, "k", "v1")
    assert db.get_setting(db_path, "k", "default") == "v1"
    db.set_setting(db_path, "k", "v2")
    assert db.get_setting(db_path, "k", "default") == "v2"
