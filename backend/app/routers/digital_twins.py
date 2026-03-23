from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db, require_read_access, require_write_access
from app.models.digital_twins import DigitalTwinDocument as DigitalTwinDocumentModel
from app.models.security import User
from app.schemas.digital_twins import DigitalTwinDocumentOut, DigitalTwinDocumentUpdate, DigitalTwinScope
from app.services.digital_twins import ensure_digital_twin, ensure_document_integrity, get_digital_twin_or_404

router = APIRouter()


def _to_out(item: DigitalTwinDocumentModel) -> DigitalTwinDocumentOut:
    return DigitalTwinDocumentOut(
        id=item.id,
        scope=item.scope,
        source_id=item.source_id,
        source_context=item.source_context,
        document=item.document_json,
        created_by_id=item.created_by_id,
        updated_by_id=item.updated_by_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
        is_deleted=item.is_deleted,
        deleted_at=item.deleted_at,
    )


@router.post("/{scope}/{source_id}/ensure", response_model=DigitalTwinDocumentOut)
def ensure_digital_twin_route(
    scope: DigitalTwinScope,
    source_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_read_access()),
):
    item = ensure_digital_twin(db, scope, source_id, current_user.id)
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.post("/{scope}/{source_id}/sync-from-operation", response_model=DigitalTwinDocumentOut)
def sync_digital_twin_from_operation(
    scope: DigitalTwinScope,
    source_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = ensure_digital_twin(db, scope, source_id, current_user.id)
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.get("/{scope}/{source_id}", response_model=DigitalTwinDocumentOut)
def get_digital_twin(
    scope: DigitalTwinScope,
    source_id: int,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    return _to_out(get_digital_twin_or_404(db, scope, source_id))


@router.patch("/{digital_twin_id}", response_model=DigitalTwinDocumentOut)
def update_digital_twin(
    digital_twin_id: int,
    payload: DigitalTwinDocumentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(DigitalTwinDocumentModel).where(DigitalTwinDocumentModel.id == digital_twin_id))
    if not item or item.is_deleted:
        raise HTTPException(status_code=404, detail="Digital twin not found")

    before = model_to_dict(item)
    data = payload.model_dump(exclude_unset=True)
    if "document" in data and payload.document is not None:
        normalized = ensure_document_integrity(payload.document)
        item.document_json = normalized.model_dump(by_alias=True)
    if "source_context" in data:
        item.source_context = data["source_context"]
    item.updated_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="digital_twin_documents",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return _to_out(item)
