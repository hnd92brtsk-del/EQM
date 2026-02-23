from app.routers import auth
from app.routers import users
from app.routers import manufacturers
from app.routers import locations
from app.routers import main_equipment
from app.routers import measurement_units
from app.routers import signal_types
from app.routers import equipment_categories
from app.routers import equipment_types
from app.routers import warehouses
from app.routers import cabinets
from app.routers import assemblies
from app.routers import warehouse_items
from app.routers import cabinet_items
from app.routers import cabinet_files
from app.routers import assembly_items
from app.routers import equipment_in_operation
from app.routers import io_signals
from app.routers import io_tree
from app.routers import movements
from app.routers import audit_logs
from app.routers import sessions
from app.routers import dashboard
from app.routers import personnel
from app.routers import chat

__all__ = [
    "auth",
    "users",
    "manufacturers",
    "locations",
    "main_equipment",
    "measurement_units",
    "signal_types",
    "equipment_categories",
    "equipment_types",
    "warehouses",
    "cabinets",
    "assemblies",
    "warehouse_items",
    "cabinet_items",
    "cabinet_files",
    "assembly_items",
    "equipment_in_operation",
    "io_signals",
    "io_tree",
    "movements",
    "audit_logs",
    "sessions",
    "dashboard",
    "chat",
]
