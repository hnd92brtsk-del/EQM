from app.schemas.cad import CadBindingResolution, CadEntityRef


def resolve_entities(_db, _user, entities: list[CadEntityRef]) -> list[CadBindingResolution]:
    """Batch resolver boundary. EQM domain adapters are intentionally Phase-1 work."""
    return [CadBindingResolution(entityType=item.entity_type, entityId=item.entity_id, status="unsupported") for item in entities]
