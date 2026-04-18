from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.versioning import read_version
from app.routers import (
    assemblies,
    assembly_items,
    audit_logs,
    auth,
    cabinet_files,
    cabinet_items,
    cabinets,
    chat,
    dashboard,
    data_types,
    diagnostics,
    digital_twins,
    entity_import_export,
    equipment_categories,
    equipment_in_operation,
    equipment_types,
    io_signals,
    io_tree,
    ipam,
    locations,
    main_equipment,
    technological_equipment,
    manufacturers,
    measurement_units,
    movements,
    network_topologies,
    personnel,
    pid,
    role_permissions,
    serial_map_documents,
    sessions,
    signal_types,
    users,
    warehouse_items,
    warehouses,
    mnt_dictionaries,
    mnt_incidents,
    mnt_work_orders,
    mnt_plans,
    mnt_operating_time,
    mnt_reliability,
)

settings = get_settings()

app = FastAPI(title="EQM API", version=read_version())

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(manufacturers.router, prefix="/api/v1/manufacturers", tags=["manufacturers"])
app.include_router(locations.router, prefix="/api/v1/locations", tags=["locations"])
app.include_router(main_equipment.router, prefix="/api/v1/main-equipment", tags=["main-equipment"])
app.include_router(
    technological_equipment.router,
    prefix="/api/v1/technological-equipment",
    tags=["technological-equipment"],
)
app.include_router(entity_import_export.router, prefix="/api/v1", tags=["entity-import-export"])
app.include_router(measurement_units.router, prefix="/api/v1/measurement-units", tags=["measurement-units"])
app.include_router(signal_types.router, prefix="/api/v1/signal-types", tags=["signal-types"])
app.include_router(data_types.router, prefix="/api/v1/data-types", tags=["data-types"])
app.include_router(equipment_categories.router, prefix="/api/v1/equipment-categories", tags=["equipment-categories"])
app.include_router(equipment_categories.router, prefix="/api/v1/equipment_categories", tags=["equipment-categories"])
app.include_router(equipment_types.router, prefix="/api/v1/equipment-types", tags=["equipment-types"])
app.include_router(warehouses.router, prefix="/api/v1/warehouses", tags=["warehouses"])
app.include_router(cabinets.router, prefix="/api/v1/cabinets", tags=["cabinets"])
app.include_router(assemblies.router, prefix="/api/v1/assemblies", tags=["assemblies"])
app.include_router(warehouse_items.router, prefix="/api/v1/warehouse-items", tags=["warehouse-items"])
app.include_router(cabinet_items.router, prefix="/api/v1/cabinet-items", tags=["cabinet-items"])
app.include_router(cabinet_files.router, prefix="/api/v1", tags=["cabinet-files"])
app.include_router(assembly_items.router, prefix="/api/v1/assembly-items", tags=["assembly-items"])
app.include_router(
    equipment_in_operation.router,
    prefix="/api/v1/equipment-in-operation",
    tags=["equipment-in-operation"],
)
app.include_router(io_signals.router, prefix="/api/v1/io-signals", tags=["io-signals"])
app.include_router(io_tree.router, prefix="/api/v1", tags=["io-tree"])
app.include_router(movements.router, prefix="/api/v1/movements", tags=["movements"])
app.include_router(audit_logs.router, prefix="/api/v1/audit-logs", tags=["audit-logs"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["sessions"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(role_permissions.router, prefix="/api/v1/admin/role-permissions", tags=["role-permissions"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(personnel.router, prefix="/api/v1/personnel", tags=["personnel"])
app.include_router(pid.router, prefix="/api/v1/pid", tags=["pid"])
app.include_router(ipam.router, prefix="/api/v1/ipam", tags=["ipam"])
app.include_router(network_topologies.router, prefix="/api/v1/network-topologies", tags=["network-topologies"])
app.include_router(serial_map_documents.router, prefix="/api/v1/serial-map-documents", tags=["serial-map-documents"])
app.include_router(diagnostics.router, prefix="/api/v1/admin/diagnostics", tags=["diagnostics"])
app.include_router(digital_twins.router, prefix="/api/v1/digital-twins", tags=["digital-twins"])
app.include_router(mnt_dictionaries.router, prefix="/api/v1/maintenance", tags=["maintenance-dictionaries"])
app.include_router(mnt_incidents.router, prefix="/api/v1/maintenance/incidents", tags=["maintenance-incidents"])
app.include_router(mnt_work_orders.router, prefix="/api/v1/maintenance/work-orders", tags=["maintenance-work-orders"])
app.include_router(mnt_plans.router, prefix="/api/v1/maintenance/plans", tags=["maintenance-plans"])
app.include_router(mnt_operating_time.router, prefix="/api/v1/maintenance/operating-time", tags=["maintenance-operating-time"])
app.include_router(mnt_reliability.router, prefix="/api/v1/maintenance/reliability", tags=["maintenance-reliability"])

pid_images_dir = settings.resolved_pid_images_dir
pid_images_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/v1/pid-storage/images", StaticFiles(directory=str(pid_images_dir)), name="pid-images")


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok", "version": read_version()}
