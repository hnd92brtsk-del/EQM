from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status


PHOTO_DIRNAME = "Photo"
DATASHEET_DIRNAME = "Datasheets"
PHOTO_MAX_BYTES = 500 * 1024
DATASHEET_MAX_BYTES = 5 * 1024 * 1024
PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
PHOTO_MIMES = {"image/jpeg", "image/png", "image/webp"}
DATASHEET_EXTS = {".pdf", ".xlsx", ".doc", ".docx"}
DATASHEET_MIMES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@dataclass(frozen=True)
class StoredFile:
    filename: str
    mime: str
    original_name: str | None
    path: Path


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def get_storage_dir(kind: str) -> Path:
    base = get_repo_root()
    if kind == "photo":
        return base / PHOTO_DIRNAME
    if kind == "datasheet":
        return base / DATASHEET_DIRNAME
    raise ValueError(f"Unsupported storage kind: {kind}")


def ensure_storage_dirs() -> None:
    get_storage_dir("photo").mkdir(parents=True, exist_ok=True)
    get_storage_dir("datasheet").mkdir(parents=True, exist_ok=True)


def _validate_upload(file: UploadFile, allowed_exts: set[str], allowed_mimes: set[str]) -> tuple[str, str]:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required")
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type",
        )
    content_type = (file.content_type or "").lower()
    if content_type not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type",
        )
    return ext, content_type


def save_upload(file: UploadFile, kind: str) -> StoredFile:
    ensure_storage_dirs()
    if kind == "photo":
        ext, mime = _validate_upload(file, PHOTO_EXTS, PHOTO_MIMES)
        max_size = PHOTO_MAX_BYTES
        storage_dir = get_storage_dir("photo")
    elif kind == "datasheet":
        ext, mime = _validate_upload(file, DATASHEET_EXTS, DATASHEET_MIMES)
        max_size = DATASHEET_MAX_BYTES
        storage_dir = get_storage_dir("datasheet")
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported upload type")

    filename = f"{uuid4().hex}{ext}"
    destination = storage_dir / filename
    size = 0
    try:
        with destination.open("wb") as target:
            while True:
                chunk = file.file.read(64 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_size:
                    target.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File is too large",
                    )
                target.write(chunk)
    except HTTPException:
        raise
    except Exception:
        destination.unlink(missing_ok=True)
        raise

    original_name = Path(file.filename).name if file.filename else None
    return StoredFile(filename=filename, mime=mime, original_name=original_name, path=destination)
