from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import or_

RU_ALPHABET = list("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя")
EN_ALPHABET = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")


def apply_search(query, q: str | None, columns):
    if not q:
        return query
    pattern = f"%{q}%"
    conditions = [col.ilike(pattern) for col in columns]
    return query.where(or_(*conditions))


def apply_sort(query, model, sort: str | None):
    if not sort:
        return query
    field = sort.lstrip("-")
    column = getattr(model, field, None)
    if column is None:
        raise HTTPException(status_code=400, detail=f"Invalid sort field: {field}")
    return query.order_by(column.desc() if sort.startswith("-") else column.asc())


def apply_date_filters(query, model, created_from: datetime | None, created_to: datetime | None,
                       updated_from: datetime | None, updated_to: datetime | None):
    if created_from is not None and hasattr(model, "created_at"):
        query = query.where(model.created_at >= created_from)
    if created_to is not None and hasattr(model, "created_at"):
        query = query.where(model.created_at <= created_to)
    if updated_from is not None and hasattr(model, "updated_at"):
        query = query.where(model.updated_at >= updated_from)
    if updated_to is not None and hasattr(model, "updated_at"):
        query = query.where(model.updated_at <= updated_to)
    return query


def apply_text_filter(query, column, value: str | None):
    if not value:
        return query
    return query.where(column.ilike(f"%{value}%"))


def apply_exact_filter(query, column, value):
    if value is None or value == "":
        return query
    return query.where(column == value)


def apply_alphabet_filter(query, column, alphabet: str | None):
    if not alphabet:
        return query

    letters = RU_ALPHABET if alphabet == "ru" else EN_ALPHABET if alphabet == "en" else None
    if not letters:
        return query

    return query.where(or_(*[column.like(f"{letter}%") for letter in letters]))
