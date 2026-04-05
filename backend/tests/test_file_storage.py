from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.core import file_storage


def _make_upload_file(name: str, content_type: str, size: int) -> UploadFile:
    return UploadFile(
        file=BytesIO(b"x" * size),
        filename=name,
        headers=Headers({"content-type": content_type}),
    )


def test_photo_upload_accepts_file_under_new_limit(tmp_path, monkeypatch):
    monkeypatch.setattr(file_storage, "get_storage_dir", lambda kind: tmp_path / kind)

    upload = _make_upload_file("cabinet.jpg", "image/jpeg", file_storage.PHOTO_MAX_BYTES - 128)

    stored = file_storage.save_upload(upload, "photo")

    assert stored.mime == "image/jpeg"
    assert stored.path.exists()
    assert stored.path.stat().st_size == file_storage.PHOTO_MAX_BYTES - 128


def test_photo_upload_rejects_file_above_new_limit(tmp_path, monkeypatch):
    monkeypatch.setattr(file_storage, "get_storage_dir", lambda kind: tmp_path / kind)

    upload = _make_upload_file("cabinet.jpg", "image/jpeg", file_storage.PHOTO_MAX_BYTES + 1)

    with pytest.raises(HTTPException) as exc_info:
        file_storage.save_upload(upload, "photo")

    assert exc_info.value.status_code == 413
    assert exc_info.value.detail == "File is too large. Maximum allowed size is 2 MB"
