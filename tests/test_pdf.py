from pathlib import Path

import pymupdf

from tutor import pdf


def make_pdf(path: Path, pages: int = 3) -> None:
    doc = pymupdf.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"Page {i + 1}")
    doc.save(path)
    doc.close()


def test_page_count(tmp_path):
    path = tmp_path / "book.pdf"
    make_pdf(path, pages=4)
    assert pdf.page_count(path) == 4


def test_render_page_png(tmp_path):
    path = tmp_path / "book.pdf"
    make_pdf(path, pages=2)
    png = pdf.render_page_png(path, 1)
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(png) > 1000


def test_render_page_out_of_range(tmp_path):
    path = tmp_path / "book.pdf"
    make_pdf(path, pages=2)
    try:
        pdf.render_page_png(path, 3)
    except IndexError:
        pass
    else:
        raise AssertionError("expected IndexError")
