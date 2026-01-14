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
from app.models.core import (
    Manufacturer,
    EquipmentType,
    EquipmentCategory,
    Warehouse,
    Personnel,
    Location,
    MeasurementUnit,
)
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
            db.flush()

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
            db.flush()

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

        measurement_units_tree = {
            "Температура": ["Кельвин (K)", "градус Цельсия (°C)", "градус Фаренгейта (°F)", "градус Ренкина (°R)"],
            "Уровень": ["Метр (м)", "миллиметр (мм)", "процент (%)", "дюйм (in)", "фут (ft)"],
            "Расход": [
                "м3/ч",
                "л/мин",
                "л/с",
                "кг/ч",
                "т/сут",
                "Нм3/ч (нормальный)",
                "См3/ч (стандартный)",
                "SCFM",
                "GPM",
            ],
            "Давление": [
                "Паскаль (Па)",
                "кПа",
                "МПа",
                "бар",
                "кгс/см2",
                "мм рт. ст.",
                "мм вод. ст.",
                "psi (psia, psig, psid)",
                "Торр",
                "мбар",
            ],
            "Плотность": [
                "кг/м3",
                "г/см3",
                "градус API",
                "градус Брикса (°Bx)",
                "градус Плато (°P)",
                "градус Боме (°Bé)",
                "градус Эксле (°Oe)",
                "градус Баллинга",
            ],
            "pH/ОВП/Оксиметрия": ["ед. pH", "милливольт (мВ)", "мг/л", "мкг/л", "% насыщения"],
            "Электропараметры": [
                "Ампер (А)",
                "мА",
                "Вольт (В)",
                "мВ",
                "Ватт (Вт)",
                "кВтч",
                "мкСм/см",
                "мСм/см",
                "Омсм",
                "МОм*см",
                "ppm (TDS)",
            ],
            "Вибрация": ["мкм", "mils", "мм/с (RMS/Peak)", "ips", "м/с2", "g", "дБ", "Гц"],
            "Концентрация газов": ["% Vol", "ppm", "ppb", "% LEL (НКПР)", "мг/м3", "мкг/м3"],
            "Энкодеры": ["имп/об (PPR)", "отсчетов (CPR)", "бит (bit)", "мкм", "LPI", "DPI", "угловые секунды", "градусы"],
            "Свет": ["Кандела (кд)", "Люмен (лм)", "Люкс (лк)", "foot-candle (fc)", "кд/м2 (нит)", "мкВт/см2"],
            "Влажность": ["% RH (относительная)", "°C Td (точка росы)", "г/м3", "г/кг", "ppmV"],
            "Масса и вес": ["кг", "т", "фунт (lb)", "Ньютон (Н)", "кН", "мВ/В (РКП)", "деления (e, d)"],
        }
        created = 0
        skipped = 0

        def get_or_create_unit(name: str, parent_id: int | None, sort_order: int | None) -> MeasurementUnit:
            unit = db.scalar(
                select(MeasurementUnit).where(
                    MeasurementUnit.name == name,
                    MeasurementUnit.parent_id == parent_id,
                    MeasurementUnit.is_deleted == False,
                )
            )
            if unit:
                return unit
            unit = db.scalar(
                select(MeasurementUnit).where(
                    MeasurementUnit.name == name,
                    MeasurementUnit.parent_id == parent_id,
                    MeasurementUnit.is_deleted == True,
                )
            )
            if unit:
                unit.is_deleted = False
                unit.deleted_at = None
                unit.deleted_by_id = None
                unit.sort_order = sort_order
                return unit
            new_unit = MeasurementUnit(name=name, parent_id=parent_id, sort_order=sort_order)
            db.add(new_unit)
            return new_unit

        for root_index, (root_name, units) in enumerate(measurement_units_tree.items(), start=1):
            root_unit = get_or_create_unit(root_name, None, root_index)
            if root_unit.id is None:
                created += 1
            else:
                skipped += 1
            db.flush()
            for child_index, child_name in enumerate(units, start=1):
                child_unit = get_or_create_unit(child_name, root_unit.id, child_index)
                if child_unit.id is None:
                    created += 1
                else:
                    skipped += 1

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
        print(f"Measurement units seed: created={created}, skipped={skipped}")
        print("Seed completed.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
