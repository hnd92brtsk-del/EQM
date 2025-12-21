from datetime import datetime, date, timedelta
from typing import Any

from sqlalchemy.inspection import inspect

from app.models.audit import AuditLog


def _json_safe(value: Any):
    """
    Recursively convert values to JSON-serializable types.
    """
    if value is None:
        return None

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, timedelta):
        return value.total_seconds()

    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]

    return value


def model_to_dict(obj) -> dict:
    """
    Convert SQLAlchemy model to dict suitable for JSON storage.
    """
    data = {}
    mapper = inspect(obj).mapper

    for column in mapper.column_attrs:
        value = getattr(obj, column.key)

        if value is None:
            data[column.key] = None
        elif hasattr(value, "value"):
            # Enum support
            data[column.key] = value.value
        else:
            data[column.key] = _json_safe(value)

    # Never log password hashes
    data.pop("password_hash", None)

    return data


def add_audit_log(
    db,
    actor_id: int,
    action: str,
    entity: str,
    entity_id: int | None = None,
    before: dict | None = None,
    after: dict | None = None,
    meta: dict | None = None,
):
    """
    Create audit log entry.
    """
    log = AuditLog(
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before=_json_safe(before),
        after=_json_safe(after),
        meta=_json_safe(meta),
    )

    db.add(log)
