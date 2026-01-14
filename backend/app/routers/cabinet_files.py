from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.core.config import BASE_DIR, get_settings
from app.core.dependencies import get_db, require_read_access, require_write_access
from app.models.core import Cabinet
from app.models.cabinet_files import CabinetFile
from app.models.security import User
from app.schemas.cabinet_files import CabinetFileOut

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".doc", ".vsdx"}
CHUNK_SIZE = 1024 * 1024


def ensure_cabinet(db, cabinet_id: int) -> Cabinet:
    cabinet = db.scalar(select(Cabinet).where(Cabinet.id == cabinet_id, Cabinet.is_deleted == False))
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet not found")
    return cabinet


def get_storage_dir() -> Path:
    settings = get_settings()
    storage_dir = Path(settings.cabinet_files_dir)
    if not storage_dir.is_absolute():
        storage_dir = BASE_DIR / storage_dir
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def normalize_ext(filename: str) -> str:
    return Path(filename).suffix.lower()


@router.get("/cabinets/{cabinet_id}/files", response_model=list[CabinetFileOut])
def list_cabinet_files(
    cabinet_id: int,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    ensure_cabinet(db, cabinet_id)
    files = db.scalars(
        select(CabinetFile)
        .where(CabinetFile.cabinet_id == cabinet_id, CabinetFile.is_deleted == False)
        .order_by(CabinetFile.created_at)
    ).all()
    return files


@router.post("/cabinets/{cabinet_id}/files", response_model=CabinetFileOut)
def upload_cabinet_file(
    cabinet_id: int,
    file: UploadFile = File(...),
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    ensure_cabinet(db, cabinet_id)
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    ext = normalize_ext(file.filename)
    if not ext or ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported file type")

    settings = get_settings()
    max_size = settings.cabinet_files_max_size
    storage_dir = get_storage_dir()
    stored_name = f"{uuid4().hex}{ext}"
    storage_path = storage_dir / stored_name

    size_bytes = 0
    try:
        with storage_path.open("wb") as target:
            while True:
                chunk = file.file.read(CHUNK_SIZE)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if max_size and size_bytes > max_size:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large"
                    )
                target.write(chunk)
    except HTTPException:
        if storage_path.exists():
            storage_path.unlink(missing_ok=True)
        raise

    attachment = CabinetFile(
        cabinet_id=cabinet_id,
        original_name=Path(file.filename).name,
        stored_name=stored_name,
        ext=ext.lstrip("."),
        size_bytes=size_bytes,
        mime=file.content_type or "application/octet-stream",
        created_by_id=current_user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/cabinet-files/{file_id}/download")
def download_cabinet_file(
    file_id: int,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    attachment = db.scalar(select(CabinetFile).where(CabinetFile.id == file_id))
    if not attachment or attachment.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    storage_path = get_storage_dir() / attachment.stored_name
    if not storage_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=str(storage_path),
        filename=attachment.original_name,
        media_type=attachment.mime,
    )


@router.delete("/cabinet-files/{file_id}")
def delete_cabinet_file(
    file_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    attachment = db.scalar(select(CabinetFile).where(CabinetFile.id == file_id))
    if not attachment or attachment.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")

    attachment.is_deleted = True
    attachment.deleted_at = datetime.utcnow()
    attachment.deleted_by_id = current_user.id
    db.commit()

    storage_path = get_storage_dir() / attachment.stored_name
    if storage_path.exists():
        storage_path.unlink(missing_ok=True)

    return {"status": "ok"}
