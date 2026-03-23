"""convert serial map documents to single scheme format

Revision ID: 0039_convert_serial_map_documents_to_single_scheme
Revises: 0038_add_serial_map_documents
Create Date: 2026-03-23 13:10:00.000000
"""

from __future__ import annotations

from datetime import datetime
import json

from alembic import op
import sqlalchemy as sa


revision = "0039_convert_serial_map_documents_to_single_scheme"
down_revision = "0038_add_serial_map_documents"
branch_labels = None
depends_on = None


documents_table = sa.table(
    "serial_map_documents",
    sa.column("id", sa.Integer),
    sa.column("name", sa.String),
    sa.column("description", sa.String),
    sa.column("scope", sa.String),
    sa.column("location_id", sa.Integer),
    sa.column("source_context", sa.JSON),
    sa.column("document_json", sa.JSON),
    sa.column("created_by_id", sa.Integer),
    sa.column("updated_by_id", sa.Integer),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
    sa.column("is_deleted", sa.Boolean),
)


def _empty_document():
    return {
        "version": 2,
        "updatedAt": datetime.utcnow().isoformat(),
        "viewport": {"x": 0, "y": 0, "zoom": 1},
        "nodes": [],
        "edges": [],
        "history": {"past": [], "future": []},
    }


def _normalize_legacy_scheme(raw_scheme: dict | None):
    if not isinstance(raw_scheme, dict):
        return _empty_document()
    return {
        "version": 2,
        "updatedAt": datetime.utcnow().isoformat(),
        "viewport": raw_scheme.get("viewport") or {"x": 0, "y": 0, "zoom": 1},
        "nodes": raw_scheme.get("nodes") or [],
        "edges": raw_scheme.get("edges") or [],
        "history": raw_scheme.get("history") or {"past": [], "future": []},
    }


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.select(documents_table)).mappings().all()
    for row in rows:
        raw = row["document_json"] or {}
        if not isinstance(raw, dict) or "schemes" not in raw:
            continue
        schemes = raw.get("schemes") or []
        active_scheme_id = raw.get("activeSchemeId")
        active_scheme = next((scheme for scheme in schemes if scheme.get("id") == active_scheme_id), schemes[0] if schemes else None)
        updated_source_context = {
            **(row["source_context"] or {}),
            "legacy_project_id": raw.get("projectId"),
            "legacy_active_scheme_id": active_scheme_id,
            "migrated_to_single_scheme": True,
        }
        bind.execute(
            documents_table.update()
            .where(documents_table.c.id == row["id"])
            .values(
                document_json=_normalize_legacy_scheme(active_scheme),
                source_context=updated_source_context,
            )
        )
        for index, scheme in enumerate(schemes):
            if active_scheme and scheme.get("id") == active_scheme.get("id"):
                continue
            bind.execute(
                documents_table.insert().values(
                    name=f"{row['name']} / {scheme.get('name') or f'Схема {index + 1}'}",
                    description=scheme.get("description") or row["description"],
                    scope=row["scope"],
                    location_id=row["location_id"],
                    source_context={
                        **(row["source_context"] or {}),
                        "legacy_project_id": raw.get("projectId"),
                        "legacy_scheme_id": scheme.get("id"),
                        "migrated_from_document_id": row["id"],
                    },
                    document_json=_normalize_legacy_scheme(scheme),
                    created_by_id=row["created_by_id"],
                    updated_by_id=row["updated_by_id"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                    is_deleted=False,
                )
            )


def downgrade() -> None:
    # The migration denormalizes legacy multi-scheme documents into multiple rows.
    # Automatic downgrade would risk destructive data loss, so it is intentionally omitted.
    pass
