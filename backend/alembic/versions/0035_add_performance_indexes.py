"""add performance indexes

Revision ID: 0035_add_performance_indexes
Revises: 0034_add_network_topology_documents
Create Date: 2026-03-21
"""

from alembic import op


revision = "0035_add_performance_indexes"
down_revision = "0034_add_network_topology_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_warehouse_items_active_warehouse_updated
        ON warehouse_items (warehouse_id, updated_at DESC)
        WHERE is_deleted = false
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_cabinet_items_active_cabinet_updated
        ON cabinet_items (cabinet_id, updated_at DESC)
        WHERE is_deleted = false
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_assembly_items_active_assembly_updated
        ON assembly_items (assembly_id, updated_at DESC)
        WHERE is_deleted = false
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_cabinets_active_location_created
        ON cabinets (location_id, created_at DESC)
        WHERE is_deleted = false
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_assemblies_active_location_created
        ON assemblies (location_id, created_at DESC)
        WHERE is_deleted = false
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_equipment_types_active_unit_price_rub
        ON equipment_types (((meta_data->>'unit_price_rub')::numeric))
        WHERE is_deleted = false AND meta_data ? 'unit_price_rub'
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_equipment_types_active_unit_price_rub")
    op.execute("DROP INDEX IF EXISTS ix_assemblies_active_location_created")
    op.execute("DROP INDEX IF EXISTS ix_cabinets_active_location_created")
    op.execute("DROP INDEX IF EXISTS ix_assembly_items_active_assembly_updated")
    op.execute("DROP INDEX IF EXISTS ix_cabinet_items_active_cabinet_updated")
    op.execute("DROP INDEX IF EXISTS ix_warehouse_items_active_warehouse_updated")
