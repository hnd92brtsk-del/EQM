from __future__ import annotations

from sqlalchemy import delete, func, select


MAX_DB_LOG_ROWS = 1000


def enforce_table_row_limit(db, model, *, max_rows: int = MAX_DB_LOG_ROWS) -> None:
    total = db.scalar(select(func.count()).select_from(model))
    if total is None or total <= max_rows:
        return

    overflow = total - max_rows
    ids_to_delete = list(
        db.scalars(select(model.id).order_by(model.id.asc()).limit(overflow))
    )
    if not ids_to_delete:
        return

    db.execute(delete(model).where(model.id.in_(ids_to_delete)))
