from __future__ import annotations

import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import BASE_DIR
from app.schemas.pid import PidDiagramPayload


PID_STORAGE_ROOT = BASE_DIR / "app" / "pid_storage"
DIAGRAMS_DIR = PID_STORAGE_ROOT / "diagrams"
IMAGES_DIR = PID_STORAGE_ROOT / "images"


def ensure_pid_storage_dirs() -> None:
    DIAGRAMS_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def diagram_path(process_id: int) -> Path:
    return DIAGRAMS_DIR / f"{process_id}.json"


def load_diagram(process_id: int) -> dict | None:
    ensure_pid_storage_dirs()
    path = diagram_path(process_id)
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_diagram_atomic(process_id: int, payload: PidDiagramPayload) -> None:
    ensure_pid_storage_dirs()
    target = diagram_path(process_id)
    data = payload.model_dump(mode="json")
    with NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=DIAGRAMS_DIR) as tmp:
        json.dump(data, tmp, ensure_ascii=False, indent=2)
        temp_name = tmp.name
    Path(temp_name).replace(target)


def save_image(file: UploadFile) -> tuple[str, str]:
    ensure_pid_storage_dirs()
    original_name = file.filename or "image"
    ext = Path(original_name).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
        raise ValueError("Unsupported image format")
    stored_name = f"{uuid4().hex}{ext}"
    full_path = IMAGES_DIR / stored_name
    with full_path.open("wb") as target:
        while True:
            chunk = file.file.read(64 * 1024)
            if not chunk:
                break
            target.write(chunk)
    return stored_name, original_name


def delete_image(stored_name: str | None) -> None:
    if not stored_name:
        return
    ensure_pid_storage_dirs()
    safe_name = Path(stored_name).name
    if not safe_name:
        return
    (IMAGES_DIR / safe_name).unlink(missing_ok=True)
