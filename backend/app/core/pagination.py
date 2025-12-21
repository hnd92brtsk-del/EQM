from sqlalchemy import select, func


def paginate(query, db, page: int, page_size: int):
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.offset((page - 1) * page_size).limit(page_size)
    ).all()
    return total, items
