import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent


@dataclass
class Settings:
    openrouter_api_key: str
    openrouter_model: str
    openrouter_effort: str
    data_dir: Path
    context_pages: int

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "tutor.db"

    @property
    def checkpoint_path(self) -> Path:
        return self.data_dir / "checkpoints.db"

    def ensure_dirs(self) -> None:
        self.uploads_dir.mkdir(parents=True, exist_ok=True)


def load_settings(data_dir: Path | None = None) -> Settings:
    return Settings(
        openrouter_api_key=os.environ.get("OPENROUTER_API_KEY", ""),
        openrouter_model=os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.5"),
        openrouter_effort=os.environ.get("OPENROUTER_EFFORT", "medium"),
        data_dir=data_dir or BASE_DIR / "data",
        context_pages=int(os.environ.get("TUTOR_CONTEXT_PAGES", "1")),
    )
