from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))
load_dotenv(BASE_DIR / ".env")

from app.db.session import SessionLocal
from app.services.reference_hierarchies import import_equipment_categories, import_manufacturers


def main() -> int:
    db = SessionLocal()
    try:
        manufacturer_stats = import_manufacturers(db)
        category_stats = import_equipment_categories(db)
        db.commit()
        print("Manufacturers import:", manufacturer_stats)
        print("Equipment categories import:", category_stats)
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
