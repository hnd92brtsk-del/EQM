from typing import Any

from fastapi import HTTPException

from app.schemas.cad import CAD_SCHEMA_VERSION, CadDocumentPayload


def validate_document(document: dict[str, Any] | CadDocumentPayload) -> dict[str, Any]:
    try:
        payload = document if isinstance(document, CadDocumentPayload) else CadDocumentPayload.model_validate(document)
    except Exception as error:
        raise HTTPException(status_code=422, detail=f"Invalid CAD document: {error}") from error
    if payload.schema_version != CAD_SCHEMA_VERSION:
        raise HTTPException(status_code=422, detail="Unsupported CAD schemaVersion")
    return payload.model_dump(by_alias=True)
