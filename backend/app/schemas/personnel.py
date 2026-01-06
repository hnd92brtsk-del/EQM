from datetime import date
from pydantic import BaseModel, Field
from typing import Optional

from app.schemas.common import EntityBase, SoftDeleteFields
from app.schemas.users import UserOut


class PersonnelBase(BaseModel):
    user_id: int | None = None
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    position: str = Field(min_length=1, max_length=200)
    personnel_number: str | None = Field(default=None, max_length=50)
    service: str | None = Field(default=None, max_length=200)
    shop: str | None = Field(default=None, max_length=200)
    department: str | None = Field(default=None, max_length=200)
    division: str | None = Field(default=None, max_length=200)
    birth_date: date | None = None
    hire_date: date | None = None
    organisation: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    notes: str | None = None


class PersonnelCreate(PersonnelBase):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    position: str = Field(min_length=1, max_length=200)


class PersonnelUpdate(BaseModel):
    user_id: int | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    position: str | None = Field(default=None, min_length=1, max_length=200)
    personnel_number: str | None = Field(default=None, max_length=50)
    service: str | None = Field(default=None, max_length=200)
    shop: str | None = Field(default=None, max_length=200)
    department: str | None = Field(default=None, max_length=200)
    division: str | None = Field(default=None, max_length=200)
    birth_date: date | None = None
    hire_date: date | None = None
    organisation: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    notes: str | None = None
    is_deleted: bool | None = None


class PersonnelCompetencyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    organisation: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=200)
    completion_date: date | None = None


class PersonnelCompetencyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    organisation: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=200)
    completion_date: date | None = None
    is_deleted: bool | None = None


class PersonnelTrainingCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    completion_date: date | None = None
    next_due_date: date | None = None
    reminder_offset_days: int | None = Field(default=0, ge=0)


class PersonnelTrainingUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    completion_date: date | None = None
    next_due_date: date | None = None
    reminder_offset_days: int | None = Field(default=None, ge=0)
    is_deleted: bool | None = None


class PersonnelCompetencyOut(EntityBase, SoftDeleteFields):
    personnel_id: int
    name: str
    organisation: Optional[str] = None
    city: Optional[str] = None
    completion_date: date | None = None
    completion_age_days: int | None = None


class PersonnelTrainingOut(EntityBase, SoftDeleteFields):
    personnel_id: int
    name: str
    completion_date: date | None = None
    next_due_date: date | None = None
    reminder_offset_days: int
    days_until_due: int | None = None
    days_since_completion: int | None = None


class PersonnelOut(EntityBase, SoftDeleteFields):
    user_id: int | None = None
    first_name: str
    last_name: str
    middle_name: str | None = None
    position: str
    personnel_number: str | None = None
    service: str | None = None
    shop: str | None = None
    department: str | None = None
    division: str | None = None
    birth_date: date | None = None
    hire_date: date | None = None
    organisation: str | None = None
    email: str | None = None
    phone: str | None = None
    notes: str | None = None
    tenure_years: int | None = None
    user: UserOut | None = None
    competencies: list[PersonnelCompetencyOut] = []
    trainings: list[PersonnelTrainingOut] = []
