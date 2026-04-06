"""add last_seen_at to user sessions

Revision ID: 0045_add_last_seen_at_to_user_sessions
Revises: 0044_add_cabinet_media_fields
Create Date: 2026-04-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0045_add_last_seen_at_to_user_sessions"
down_revision = "0044_add_cabinet_media_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_sessions", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_user_sessions_last_seen_at", "user_sessions", ["last_seen_at"], unique=False)
    op.execute("UPDATE user_sessions SET last_seen_at = started_at WHERE last_seen_at IS NULL")


def downgrade() -> None:
    op.drop_index("ix_user_sessions_last_seen_at", table_name="user_sessions")
    op.drop_column("user_sessions", "last_seen_at")
