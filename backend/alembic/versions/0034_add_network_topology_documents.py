"""add network topology documents

Revision ID: 0034_add_network_topology_documents
Revises: 0033_remove_subnet_prefix_restriction
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0034_add_network_topology_documents"
down_revision = "0033_remove_subnet_prefix_restriction"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "network_topology_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("scope", sa.String(length=64), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("source_context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("document_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_network_topology_documents_created_by_id"), "network_topology_documents", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_network_topology_documents_location_id"), "network_topology_documents", ["location_id"], unique=False)
    op.create_index(op.f("ix_network_topology_documents_scope"), "network_topology_documents", ["scope"], unique=False)
    op.create_index(op.f("ix_network_topology_documents_updated_by_id"), "network_topology_documents", ["updated_by_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_network_topology_documents_updated_by_id"), table_name="network_topology_documents")
    op.drop_index(op.f("ix_network_topology_documents_scope"), table_name="network_topology_documents")
    op.drop_index(op.f("ix_network_topology_documents_location_id"), table_name="network_topology_documents")
    op.drop_index(op.f("ix_network_topology_documents_created_by_id"), table_name="network_topology_documents")
    op.drop_table("network_topology_documents")
