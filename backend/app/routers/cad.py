from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import or_, select

from app.core.dependencies import get_db, get_current_user
from app.core.access import SpaceKey, require_space_access
from app.core.pagination import paginate
from app.models.cad import CadDocument
from app.models.security import User
from app.schemas.cad import (
    CadDocumentCreate, CadDocumentOut, CadDocumentUpdate, CadEntityResolveRequest,
    CadEntityResolveResponse, CadVersionedMutation,
)
from app.services.cad.documents import (
    create_document, get_active_or_404, restore_document, soft_delete_document, to_out, update_document,
)
from app.services.cad.entity_resolver import resolve_entities

router = APIRouter()
read_engineering = require_space_access(SpaceKey.engineering, "read")
write_engineering = require_space_access(SpaceKey.engineering, "write")


@router.get("/documents", response_model=list[CadDocumentOut])
def list_documents(q: str | None = None, profile: str | None = None, location_id: int | None = None,
                   db=Depends(get_db), _user: User = Depends(read_engineering)):
    query = select(CadDocument).where(CadDocument.is_deleted == False)
    if q:
        query = query.where(or_(CadDocument.name.ilike(f"%{q}%"), CadDocument.description.ilike(f"%{q}%")))
    if profile:
        query = query.where(CadDocument.profile == profile)
    if location_id is not None:
        query = query.where(CadDocument.location_id == location_id)
    return [to_out(item) for item in db.scalars(query.order_by(CadDocument.updated_at.desc())).all()]


@router.post("/documents", response_model=CadDocumentOut, status_code=201)
def create(payload: CadDocumentCreate, db=Depends(get_db), current_user: User = Depends(write_engineering)):
    return to_out(create_document(db, payload, current_user.id))


@router.get("/documents/{document_id}", response_model=CadDocumentOut)
def get(document_id: int, db=Depends(get_db), _user: User = Depends(read_engineering)):
    return to_out(get_active_or_404(db, document_id))


@router.patch("/documents/{document_id}", response_model=CadDocumentOut)
def patch(document_id: int, payload: CadDocumentUpdate, db=Depends(get_db), current_user: User = Depends(write_engineering)):
    return to_out(update_document(db, document_id, payload, current_user.id))


@router.delete("/documents/{document_id}", status_code=204)
def delete(document_id: int, payload: CadVersionedMutation, db=Depends(get_db), current_user: User = Depends(write_engineering)):
    soft_delete_document(db, document_id, payload.expected_version, current_user.id)
    return Response(status_code=204)


@router.post("/documents/{document_id}/restore", response_model=CadDocumentOut)
def restore(document_id: int, payload: CadVersionedMutation, db=Depends(get_db), current_user: User = Depends(write_engineering)):
    return to_out(restore_document(db, document_id, payload.expected_version, current_user.id))


@router.post("/entities/resolve", response_model=CadEntityResolveResponse)
def resolve(payload: CadEntityResolveRequest, db=Depends(get_db), current_user: User = Depends(read_engineering)):
    return CadEntityResolveResponse(items=resolve_entities(db, current_user, payload.entities))
