from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select, update

from app.core.audit import add_audit_log, model_to_dict
from app.models.cad import CadDocument
from app.schemas.cad import CadDocumentCreate, CadDocumentOut, CadDocumentUpdate
from app.services.cad.bindings import rebuild_binding_index
from app.services.cad.validation import validate_document


def to_out(item: CadDocument) -> CadDocumentOut:
    return CadDocumentOut(
        id=item.id, name=item.name, description=item.description, profile=item.profile,
        location_id=item.location_id, owner_type=item.owner_type, owner_id=item.owner_id,
        schema_version=item.schema_version, row_version=item.row_version,
        document=item.document_json, created_by_id=item.created_by_id, updated_by_id=item.updated_by_id,
        created_at=item.created_at, updated_at=item.updated_at, is_deleted=item.is_deleted,
        deleted_at=item.deleted_at,
    )


def get_active_or_404(db, document_id: int) -> CadDocument:
    item = db.scalar(select(CadDocument).where(CadDocument.id == document_id, CadDocument.is_deleted == False))
    if not item:
        raise HTTPException(status_code=404, detail="CAD document not found")
    return item


def create_document(db, payload: CadDocumentCreate, actor_id: int) -> CadDocument:
    document = validate_document(payload.document)
    item = CadDocument(
        name=payload.name, description=payload.description, profile=payload.profile,
        location_id=payload.location_id, owner_type=payload.owner_type, owner_id=payload.owner_id,
        schema_version=document["schemaVersion"], document_json=document,
        created_by_id=actor_id, updated_by_id=actor_id, is_deleted=False,
    )
    db.add(item)
    db.flush()
    rebuild_binding_index(db, item.id, document)
    add_audit_log(db, actor_id, "CREATE", "cad_documents", item.id, after=model_to_dict(item))
    db.commit()
    db.refresh(item)
    return item


def update_document(db, document_id: int, payload: CadDocumentUpdate, actor_id: int) -> CadDocument:
    current = get_active_or_404(db, document_id)
    before = model_to_dict(current)
    values = payload.model_dump(exclude_unset=True, by_alias=False, exclude={"expected_version", "document"})
    document = current.document_json
    if payload.document is not None:
        document = validate_document(payload.document)
        values["document_json"] = document
        values["schema_version"] = document["schemaVersion"]
    values["updated_by_id"] = actor_id
    values["row_version"] = payload.expected_version + 1

    result = db.execute(
        update(CadDocument)
        .where(CadDocument.id == document_id, CadDocument.is_deleted == False, CadDocument.row_version == payload.expected_version)
        .values(**values)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="CAD document version conflict")
    if payload.document is not None:
        rebuild_binding_index(db, document_id, document)
    updated = get_active_or_404(db, document_id)
    add_audit_log(db, actor_id, "UPDATE", "cad_documents", document_id, before=before, after=model_to_dict(updated))
    db.commit()
    db.refresh(updated)
    return updated


def soft_delete_document(db, document_id: int, expected_version: int, actor_id: int) -> None:
    item = get_active_or_404(db, document_id)
    before = model_to_dict(item)
    result = db.execute(
        update(CadDocument)
        .where(CadDocument.id == document_id, CadDocument.is_deleted == False, CadDocument.row_version == expected_version)
        .values(
            is_deleted=True,
            deleted_at=datetime.now(UTC),
            deleted_by_id=actor_id,
            row_version=expected_version + 1,
            updated_by_id=actor_id,
        )
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="CAD document version conflict")
    add_audit_log(db, actor_id, "DELETE", "cad_documents", document_id, before=before)
    db.commit()


def restore_document(db, document_id: int, expected_version: int, actor_id: int) -> CadDocument:
    item = db.scalar(select(CadDocument).where(CadDocument.id == document_id))
    if not item:
        raise HTTPException(status_code=404, detail="CAD document not found")

    before = model_to_dict(item)
    result = db.execute(
        update(CadDocument)
        .where(CadDocument.id == document_id, CadDocument.is_deleted == True, CadDocument.row_version == expected_version)
        .values(
            is_deleted=False,
            deleted_at=None,
            deleted_by_id=None,
            updated_by_id=actor_id,
            row_version=expected_version + 1,
        )
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="CAD document version conflict")

    restored = db.scalar(select(CadDocument).where(CadDocument.id == document_id))
    add_audit_log(db, actor_id, "RESTORE", "cad_documents", document_id, before=before, after=model_to_dict(restored))
    db.commit()
    db.refresh(restored)
    return restored
