from pathlib import Path

import pymupdf


def page_count(path: Path) -> int:
    with pymupdf.open(path) as doc:
        return doc.page_count


def render_page_png(path: Path, page_number: int, dpi: int = 150) -> bytes:
    """Render a 1-based page number to PNG bytes."""
    with pymupdf.open(path) as doc:
        if page_number < 1 or page_number > doc.page_count:
            raise IndexError(f"page {page_number} out of range (1..{doc.page_count})")
        page = doc[page_number - 1]
        pix = page.get_pixmap(dpi=dpi)
        return pix.tobytes("png")
