from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import (
    auth,
    users,
    manufacturers,
    locations,
    main_equipment,
    measurement_units,
    signal_types,
    equipment_categories,
    equipment_types,
    warehouses,
    cabinets,
    assemblies,
    warehouse_items,
    cabinet_items,
    cabinet_files,
    assembly_items,
    io_signals,
    io_tree,
    movements,
    audit_logs,
    sessions,
    dashboard,
    personnel,
    chat,
    equipment_in_operation,
)

settings = get_settings()

app = FastAPI(title="EQM API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(manufacturers.router, prefix="/api/v1/manufacturers", tags=["manufacturers"])
app.include_router(locations.router, prefix="/api/v1/locations", tags=["locations"])
app.include_router(main_equipment.router, prefix="/api/v1/main-equipment", tags=["main-equipment"])
app.include_router(measurement_units.router, prefix="/api/v1/measurement-units", tags=["measurement-units"])
app.include_router(signal_types.router, prefix="/api/v1/signal-types", tags=["signal-types"])
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
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(personnel.router, prefix="/api/v1/personnel", tags=["personnel"])


@app.get("/")
def root():
    return {"status": "ok"}
