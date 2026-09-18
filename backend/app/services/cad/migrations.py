from typing import Any

from app.services.cad.validation import validate_document


def migrate_document(document: dict[str, Any]) -> dict[str, Any]:
    """Schema migration entry point; Phase 0 only supports v1 -> v1."""
    return validate_document(document)
