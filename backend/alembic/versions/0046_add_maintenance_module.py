"""add maintenance module

Revision ID: 0046_add_maintenance_module
Revises: 0045_add_last_seen_at_to_user_sessions
Create Date: 2026-04-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0046_add_maintenance_module"
down_revision = "0045_add_last_seen_at_to_user_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Dictionaries ---
    op.create_table(
        "mnt_failure_modes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50)),
        sa.Column("equipment_category_id", sa.Integer, sa.ForeignKey("equipment_categories.id", ondelete="SET NULL"), index=True),
        sa.Column("description", sa.Text),
        sa.Column("parent_id", sa.Integer, sa.ForeignKey("mnt_failure_modes.id", ondelete="SET NULL"), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("row_version", sa.Integer, server_default="1", nullable=False),
    )

    op.create_table(
        "mnt_failure_mechanisms",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50)),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("row_version", sa.Integer, server_default="1", nullable=False),
    )

    op.create_table(
        "mnt_failure_causes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50)),
        sa.Column("category", sa.String(50)),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("row_version", sa.Integer, server_default="1", nullable=False),
    )

    op.create_table(
        "mnt_detection_methods",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50)),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("row_version", sa.Integer, server_default="1", nullable=False),
    )

    op.create_table(
        "mnt_activity_types",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50)),
        sa.Column("category", sa.String(50)),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("row_version", sa.Integer, server_default="1", nullable=False),
    )

    # --- Maintenance Plans (must come before work_orders due to FK) ---
    op.create_table(
        "mnt_plans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50)),
        sa.Column("equipment_category_id", sa.Integer, sa.ForeignKey("equipment_categories.id", ondelete="SET NULL")),
        sa.Column("equipment_type_id", sa.Integer, sa.ForeignKey("equipment_types.id", ondelete="SET NULL")),
        sa.Column("cabinet_id", sa.Integer, sa.ForeignKey("cabinets.id", ondelete="SET NULL")),
        sa.Column("interval_days", sa.Integer, nullable=False),
        sa.Column("activity_type_id", sa.Integer, sa.ForeignKey("mnt_activity_types.id", ondelete="SET NULL")),
        sa.Column("estimated_man_hours", sa.Numeric(8, 2)),
        sa.Column("description", sa.Text),
        sa.Column("last_generated_date", sa.Date),
        sa.Column("next_due_date", sa.Date),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("row_version", sa.Integer, server_default="1", nullable=False),
    )

    # --- Incidents ---
    op.create_table(
        "mnt_incidents",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("incident_number", sa.String(50), unique=True),
        sa.Column("cabinet_id", sa.Integer, sa.ForeignKey("cabinets.id"), index=True, nullable=False),
        sa.Column("location_id", sa.Integer, sa.ForeignKey("locations.id"), index=True),
        sa.Column("severity", sa.String(20)),
        sa.Column("detection_method_id", sa.Integer, sa.ForeignKey("mnt_detection_methods.id", ondelete="SET NULL")),
        sa.Column("failure_mode_id", sa.Integer, sa.ForeignKey("mnt_failure_modes.id", ondelete="SET NULL")),
        sa.Column("failure_mechanism_id", sa.Integer, sa.ForeignKey("mnt_failure_mechanisms.id", ondelete="SET NULL")),
        sa.Column("failure_cause_id", sa.Integer, sa.ForeignKey("mnt_failure_causes.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(20), server_default="open", nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("repair_started_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("root_cause_analysis", sa.Text),
        sa.Column("resolution_notes", sa.Text),
        sa.Column("man_hours", sa.Numeric(8, 2)),
        sa.Column("downtime_hours", sa.Numeric(8, 2)),
        sa.Column("operational_impact", sa.String(32)),
        sa.Column("reported_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_to_id", sa.Integer, sa.ForeignKey("personnel.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("row_version", sa.Integer, server_default="1", nullable=False),
    )

    op.create_table(
        "mnt_incident_components",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("incident_id", sa.Integer, sa.ForeignKey("mnt_incidents.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("cabinet_item_id", sa.Integer, sa.ForeignKey("cabinet_items.id"), index=True, nullable=False),
        sa.Column("equipment_type_id", sa.Integer, sa.ForeignKey("equipment_types.id")),
        sa.Column("failure_mode_id", sa.Integer, sa.ForeignKey("mnt_failure_modes.id", ondelete="SET NULL")),
        sa.Column("damage_description", sa.Text),
        sa.Column("action_taken", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- Work Orders ---
    op.create_table(
        "mnt_work_orders",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("order_number", sa.String(50), unique=True),
        sa.Column("order_type", sa.String(32), nullable=False),
        sa.Column("activity_type_id", sa.Integer, sa.ForeignKey("mnt_activity_types.id", ondelete="SET NULL")),
        sa.Column("priority", sa.String(20), server_default="normal", nullable=False),
        sa.Column("status", sa.String(20), server_default="planned", nullable=False),
        sa.Column("cabinet_id", sa.Integer, sa.ForeignKey("cabinets.id"), index=True),
        sa.Column("incident_id", sa.Integer, sa.ForeignKey("mnt_incidents.id", ondelete="SET NULL")),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("mnt_plans.id", ondelete="SET NULL")),
        sa.Column("planned_start_date", sa.Date),
        sa.Column("planned_end_date", sa.Date),
        sa.Column("actual_start_at", sa.DateTime(timezone=True)),
        sa.Column("actual_end_at", sa.DateTime(timezone=True)),
        sa.Column("estimated_man_hours", sa.Numeric(8, 2)),
        sa.Column("actual_man_hours", sa.Numeric(8, 2)),
        sa.Column("assigned_to_id", sa.Integer, sa.ForeignKey("personnel.id", ondelete="SET NULL")),
        sa.Column("performed_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("completion_notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("row_version", sa.Integer, server_default="1", nullable=False),
    )

    op.create_table(
        "mnt_work_order_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("work_order_id", sa.Integer, sa.ForeignKey("mnt_work_orders.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("cabinet_item_id", sa.Integer, sa.ForeignKey("cabinet_items.id")),
        sa.Column("equipment_type_id", sa.Integer, sa.ForeignKey("equipment_types.id")),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("quantity", sa.Integer, server_default="1", nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- Operating Time ---
    op.create_table(
        "mnt_operating_time",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("cabinet_id", sa.Integer, sa.ForeignKey("cabinets.id"), index=True, nullable=False),
        sa.Column("recorded_date", sa.Date, nullable=False),
        sa.Column("operating_hours", sa.Numeric(8, 2), server_default="0", nullable=False),
        sa.Column("standby_hours", sa.Numeric(8, 2), server_default="0", nullable=False),
        sa.Column("downtime_hours", sa.Numeric(8, 2), server_default="0", nullable=False),
        sa.Column("recorded_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("cabinet_id", "recorded_date", name="uq_mnt_operating_time_cab_date"),
    )

    # --- Seed access space ---
    op.execute("INSERT INTO access_spaces (key, label, is_admin_space) VALUES ('maintenance', 'Maintenance', false) ON CONFLICT DO NOTHING")
    op.execute("INSERT INTO role_space_permissions (role, space_key, can_read, can_write, can_admin) VALUES ('admin', 'maintenance', true, true, false) ON CONFLICT DO NOTHING")
    op.execute("INSERT INTO role_space_permissions (role, space_key, can_read, can_write, can_admin) VALUES ('engineer', 'maintenance', true, true, false) ON CONFLICT DO NOTHING")
    op.execute("INSERT INTO role_space_permissions (role, space_key, can_read, can_write, can_admin) VALUES ('viewer', 'maintenance', true, false, false) ON CONFLICT DO NOTHING")

    # --- Seed ISO 14224 dictionaries ---
    op.execute("""
        INSERT INTO mnt_failure_mechanisms (name, code, description) VALUES
        ('Corrosion', 'COR', 'Material degradation by chemical/electrochemical reaction'),
        ('Erosion', 'ERO', 'Material loss by fluid or particle impact'),
        ('Fatigue', 'FAT', 'Cracking from cyclic loading'),
        ('Wear', 'WEA', 'Material loss from surface contact/friction'),
        ('Overheating', 'OHE', 'Excessive temperature beyond design limits'),
        ('Vibration', 'VIB', 'Excessive mechanical oscillation'),
        ('Electrical failure', 'ELE', 'Short circuit, open circuit, insulation breakdown'),
        ('Contamination', 'CON', 'Ingress of foreign material'),
        ('Deformation', 'DEF', 'Permanent shape change under load'),
        ('Blockage', 'BLK', 'Flow restriction or clogging')
        ON CONFLICT DO NOTHING
    """)

    op.execute("""
        INSERT INTO mnt_failure_causes (name, code, category) VALUES
        ('Design error', 'DES', 'design'),
        ('Manufacturing defect', 'MFG', 'fabrication'),
        ('Installation error', 'INS', 'installation'),
        ('Operating error', 'OPE', 'operation'),
        ('Maintenance error', 'MNT', 'maintenance'),
        ('Management failure', 'MGT', 'management'),
        ('Normal wear and tear', 'NRM', 'operation'),
        ('External influence', 'EXT', 'operation')
        ON CONFLICT DO NOTHING
    """)

    op.execute("""
        INSERT INTO mnt_detection_methods (name, code) VALUES
        ('Periodic maintenance', 'PRD'),
        ('Continuous monitoring', 'CON'),
        ('Visual inspection', 'INS'),
        ('On demand', 'DEM'),
        ('Operator observation', 'OBS'),
        ('Alarm / trip', 'ALM')
        ON CONFLICT DO NOTHING
    """)

    op.execute("""
        INSERT INTO mnt_activity_types (name, code, category) VALUES
        ('Corrective repair', 'COR', 'corrective'),
        ('Preventive maintenance', 'PRV', 'preventive'),
        ('Condition-based maintenance', 'CBM', 'condition_based'),
        ('Scheduled replacement', 'REP', 'preventive'),
        ('Modification / upgrade', 'MOD', 'improvement'),
        ('Inspection', 'INS', 'preventive'),
        ('Emergency repair', 'EMR', 'corrective')
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM role_space_permissions WHERE space_key = 'maintenance'")
    op.execute("DELETE FROM access_spaces WHERE key = 'maintenance'")
    op.drop_table("mnt_work_order_items")
    op.drop_table("mnt_work_orders")
    op.drop_table("mnt_incident_components")
    op.drop_table("mnt_incidents")
    op.drop_table("mnt_operating_time")
    op.drop_table("mnt_plans")
    op.drop_table("mnt_activity_types")
    op.drop_table("mnt_detection_methods")
    op.drop_table("mnt_failure_causes")
    op.drop_table("mnt_failure_mechanisms")
    op.drop_table("mnt_failure_modes")
