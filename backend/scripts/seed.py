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
from app.models.core import Manufacturer, EquipmentType, EquipmentCategory, Warehouse, Personnel, Location
from app.models.assemblies import Assembly
from app.models.operations import AssemblyItem


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

        location = db.scalar(
            select(Location).where(Location.name == "Локация 1", Location.is_deleted == False)
        )
        if not location:
            location = Location(name="Локация 1")
            db.add(location)

        assembly = db.scalar(
            select(Assembly).where(Assembly.name == "Сборка 1", Assembly.is_deleted == False)
        )
        if not assembly:
            assembly = Assembly(name="Сборка 1", location=location)
            db.add(assembly)

        if et and assembly:
            assembly_item = db.scalar(
                select(AssemblyItem).where(
                    AssemblyItem.assembly_id == assembly.id,
                    AssemblyItem.equipment_type_id == et.id,
                )
            )
            if not assembly_item:
                assembly_item = AssemblyItem(
                    assembly_id=assembly.id,
                    equipment_type_id=et.id,
                    quantity=2,
                )
                db.add(assembly_item)

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
                ai_count=16,
                di_count=0,
                ao_count=0,
                do_count=0,
                is_network=False,
                meta_data={"unit_price_rub": 100000},
            )
            db.add(et)

        category_names = [
            "ПЛК",
            "Реле",
            "HMI",
            "Блок питания",
            "Преобразователь",
            "Программируемое реле",
        ]
        for name in category_names:
            category = db.scalar(
                select(EquipmentCategory).where(
                    EquipmentCategory.name == name
                )
            )
            if not category:
                category = EquipmentCategory(name=name)
                db.add(category)
            elif category.is_deleted:
                category.is_deleted = False
                category.deleted_at = None
                category.deleted_by_id = None

        db.commit()
        existing_personnel = db.scalar(select(Personnel).limit(1))
        if not existing_personnel:
            person = Personnel(
                first_name="Иван",
                last_name="Иванов",
                position="Инженер",
                department="АСУ",
                organisation="EQM Demo"
            )
            db.add(person)
            db.commit()
        print("Seed completed.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
