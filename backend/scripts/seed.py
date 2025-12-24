import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import select

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

load_dotenv(BASE_DIR / ".env")

from app.db.session import SessionLocal
from app.core.security import hash_password, verify_password
from app.models.security import User, UserRole
from app.models.core import Manufacturer, EquipmentType, Warehouse


def run():
    db = SessionLocal()
    try:
        admin_username = os.getenv("SEED_ADMIN_USERNAME", "admin")
        admin_password = os.getenv("SEED_ADMIN_PASSWORD", "admin12345")
        admin = db.scalar(select(User).where(User.username == admin_username))
        if not admin:
            admin = User(
                username=admin_username,
                password_hash=hash_password(admin_password),
                role=UserRole.admin,
            )
            db.add(admin)
        else:
            if admin.is_deleted:
                admin.is_deleted = False
                admin.deleted_at = None
                admin.deleted_by_id = None
            if admin.role != UserRole.admin:
                admin.role = UserRole.admin
            if not verify_password(admin_password, admin.password_hash):
                admin.password_hash = hash_password(admin_password)

        siemens = db.scalar(
            select(Manufacturer).where(Manufacturer.name == "Siemens", Manufacturer.is_deleted == False)
        )
        if not siemens:
            siemens = Manufacturer(name="Siemens", country="Germany")
            db.add(siemens)

        wh = db.scalar(
            select(Warehouse).where(Warehouse.name == "Склад 1", Warehouse.is_deleted == False)
        )
        if not wh:
            wh = Warehouse(name="Склад 1")
            db.add(wh)

        et = db.scalar(
            select(EquipmentType).where(
                EquipmentType.nomenclature_number == "PLC-001", EquipmentType.is_deleted == False
            )
        )
        if not et:
            et = EquipmentType(
                name="PLC базовый",
                nomenclature_number="PLC-001",
                manufacturer=siemens,
                is_channel_forming=True,
                channel_count=16,
                meta_data={"unit_price_rub": 100000},
            )
            db.add(et)

        db.commit()
        print("Seed completed.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
