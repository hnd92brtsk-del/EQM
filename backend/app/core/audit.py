from sqlalchemy.inspection import inspect

from app.models.audit import AuditLog


def model_to_dict(obj) -> dict:
    data = {}
    mapper = inspect(obj).mapper
    for column in mapper.column_attrs:
        value = getattr(obj, column.key)
        if value is None:
            data[column.key] = None
        elif hasattr(value, "value"):
            data[column.key] = value.value
        else:
            data[column.key] = value
    data.pop("password_hash", None)
    return data


def add_audit_log(db, actor_id: int, action: str, entity: str, entity_id=None, before=None, after=None, meta=None):
    log = AuditLog(
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before=before,
        after=after,
        meta=meta,
    )
    db.add(log)
