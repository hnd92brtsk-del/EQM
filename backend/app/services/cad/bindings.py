from sqlalchemy import delete

from app.models.cad import CadEntityBinding


def rebuild_binding_index(db, document_id: int, document: dict) -> None:
    """Rebuild the derived searchable binding index in the same transaction."""
    db.execute(delete(CadEntityBinding).where(CadEntityBinding.document_id == document_id))
    for element in document.get("elements", []):
        element_id = str(element.get("id", ""))
        for binding in element.get("bindings", []):
            if not element_id or not isinstance(binding, dict):
                continue
            entity_type, entity_id = binding.get("entityType"), binding.get("entityId")
            binding_id = binding.get("id")
            if not entity_type or entity_id is None or not binding_id:
                continue
            snapshot = binding.get("snapshot") or {}
            db.add(CadEntityBinding(
                document_id=document_id, element_id=element_id, binding_id=str(binding_id),
                binding_role=str(binding.get("role", "primary")), entity_type=str(entity_type),
                entity_id=str(entity_id), snapshot_name=snapshot.get("name"),
            ))
