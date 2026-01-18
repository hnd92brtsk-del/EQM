"""seed signal types base tree

Revision ID: 0018_seed_signal_types_base_tree
Revises: 0017_add_signal_types_dictionary
Create Date: 2026-01-22 13:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0018_seed_signal_types_base_tree"
down_revision = "0017_add_signal_types_dictionary"
branch_labels = None
depends_on = None

ROOTS = ["AI", "AO", "DI", "DO"]
CHILDREN = {
    "AI": ["4-20mA", "0-20mA", "0-10V", "Pt100", "Pt1000", "M50"],
    "AO": ["4-20mA", "0-20mA", "0-10V"],
    "DI": ["24V", "220V", "8-16mA"],
    "DO": ["24V", "220V"],
}


def _fetch_id(conn, name: str, parent_id: int | None) -> int | None:
    if parent_id is None:
        result = conn.execute(
            sa.text(
                """
                select id
                from signal_types
                where name = :name
                  and parent_id is null
                  and is_deleted = false
                """
            ),
            {"name": name},
        )
    else:
        result = conn.execute(
            sa.text(
                """
                select id
                from signal_types
                where name = :name
                  and parent_id = :parent_id
                  and is_deleted = false
                """
            ),
            {"name": name, "parent_id": parent_id},
        )
    return result.scalar()


def _insert(conn, name: str, parent_id: int | None) -> int:
    result = conn.execute(
        sa.text(
            """
            insert into signal_types (name, parent_id)
            values (:name, :parent_id)
            returning id
            """
        ),
        {"name": name, "parent_id": parent_id},
    )
    return result.scalar_one()


def upgrade():
    conn = op.get_bind()
    root_ids: dict[str, int] = {}

    for root in ROOTS:
        existing_id = _fetch_id(conn, root, None)
        if existing_id is None:
            existing_id = _insert(conn, root, None)
        root_ids[root] = existing_id

    for root, children in CHILDREN.items():
        parent_id = root_ids.get(root)
        if not parent_id:
            continue
        for child in children:
            if _fetch_id(conn, child, parent_id) is None:
                _insert(conn, child, parent_id)


def downgrade():
    conn = op.get_bind()
    root_ids = {root: _fetch_id(conn, root, None) for root in ROOTS}

    for root, children in CHILDREN.items():
        parent_id = root_ids.get(root)
        if not parent_id:
            continue
        for child in children:
            conn.execute(
                sa.text(
                    """
                    delete from signal_types
                    where parent_id = :parent_id
                      and name = :name
                    """
                ),
                {"parent_id": parent_id, "name": child},
            )
        remaining = conn.execute(
            sa.text(
                """
                select 1
                from signal_types
                where parent_id = :parent_id
                limit 1
                """
            ),
            {"parent_id": parent_id},
        ).scalar()
        if remaining is None:
            conn.execute(
                sa.text("delete from signal_types where id = :id"),
                {"id": parent_id},
            )
