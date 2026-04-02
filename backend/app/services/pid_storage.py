from __future__ import annotations

import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings
from app.schemas.pid import PidDiagramPayload


def ensure_pid_storage_dirs() -> None:
    settings = get_settings()
    settings.resolved_pid_diagrams_dir.mkdir(parents=True, exist_ok=True)
    settings.resolved_pid_images_dir.mkdir(parents=True, exist_ok=True)


def diagram_path(process_id: int) -> Path:
    settings = get_settings()
    return settings.resolved_pid_diagrams_dir / f"{process_id}.json"


def load_diagram(process_id: int) -> dict | None:
    ensure_pid_storage_dirs()
    path = diagram_path(process_id)
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_diagram_atomic(process_id: int, payload: PidDiagramPayload) -> None:
    settings = get_settings()
    ensure_pid_storage_dirs()
    target = diagram_path(process_id)
    data = payload.model_dump(mode="json")
    with NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=settings.resolved_pid_diagrams_dir) as tmp:
        json.dump(data, tmp, ensure_ascii=False, indent=2)
        temp_name = tmp.name
    Path(temp_name).replace(target)


def save_image(file: UploadFile) -> tuple[str, str]:
    settings = get_settings()
    ensure_pid_storage_dirs()
    original_name = file.filename or "image"
    ext = Path(original_name).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
        raise ValueError("Unsupported image format")
    stored_name = f"{uuid4().hex}{ext}"
    full_path = settings.resolved_pid_images_dir / stored_name
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
    settings = get_settings()
    ensure_pid_storage_dirs()
    safe_name = Path(stored_name).name
    if not safe_name:
        return
    (settings.resolved_pid_images_dir / safe_name).unlink(missing_ok=True)
