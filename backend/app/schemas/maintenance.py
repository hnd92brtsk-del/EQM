from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, SoftDeleteFields


# ---------------------------------------------------------------------------
# Dictionary schemas (shared pattern)
# ---------------------------------------------------------------------------

class MntDictBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=50)
    description: str | None = None


class MntDictOut(EntityBase, SoftDeleteFields):
    name: str
    code: str | None = None
    description: str | None = None


# --- Failure Modes ---

class FailureModeCreate(MntDictBase):
    equipment_category_id: int | None = None
    parent_id: int | None = None


class FailureModeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=50)
    description: str | None = None
    equipment_category_id: int | None = None
    parent_id: int | None = None
    is_deleted: bool | None = None


class FailureModeOut(MntDictOut):
    equipment_category_id: int | None = None
    parent_id: int | None = None


# --- Failure Mechanisms ---

class FailureMechanismCreate(MntDictBase):
    pass


class FailureMechanismUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=50)
    description: str | None = None
    is_deleted: bool | None = None


class FailureMechanismOut(MntDictOut):
    pass


# --- Failure Causes ---

class FailureCauseCreate(MntDictBase):
    category: str | None = Field(default=None, max_length=50)


class FailureCauseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=50)
    description: str | None = None
    is_deleted: bool | None = None


class FailureCauseOut(MntDictOut):
    category: str | None = None


# --- Detection Methods ---

class DetectionMethodCreate(MntDictBase):
    pass


class DetectionMethodUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=50)
    description: str | None = None
    is_deleted: bool | None = None


class DetectionMethodOut(MntDictOut):
    pass


# --- Activity Types ---

class ActivityTypeCreate(MntDictBase):
    category: str | None = Field(default=None, max_length=50)


class ActivityTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=50)
    description: str | None = None
    is_deleted: bool | None = None


class ActivityTypeOut(MntDictOut):
    category: str | None = None


# ---------------------------------------------------------------------------
# Incident Component
# ---------------------------------------------------------------------------

class IncidentComponentCreate(BaseModel):
    cabinet_item_id: int
    equipment_type_id: int | None = None
    failure_mode_id: int | None = None
    damage_description: str | None = None
    action_taken: str | None = Field(default=None, max_length=50)


class IncidentComponentOut(BaseModel):
    id: int
    incident_id: int
    cabinet_item_id: int
    equipment_type_id: int | None = None
    failure_mode_id: int | None = None
    damage_description: str | None = None
    action_taken: str | None = None
    # joined names
    equipment_type_name: str | None = None
    failure_mode_name: str | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Incidents
# ---------------------------------------------------------------------------

class IncidentCreate(BaseModel):
    cabinet_id: int
    location_id: int | None = None
    severity: str | None = Field(default=None, max_length=20)
    detection_method_id: int | None = None
    failure_mode_id: int | None = None
    failure_mechanism_id: int | None = None
    failure_cause_id: int | None = None
    occurred_at: datetime
    detected_at: datetime
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    operational_impact: str | None = Field(default=None, max_length=32)
    assigned_to_id: int | None = None
    components: list[IncidentComponentCreate] | None = None


class IncidentUpdate(BaseModel):
    severity: str | None = Field(default=None, max_length=20)
    status: str | None = Field(default=None, max_length=20)
    detection_method_id: int | None = None
    failure_mode_id: int | None = None
    failure_mechanism_id: int | None = None
    failure_cause_id: int | None = None
    repair_started_at: datetime | None = None
    resolved_at: datetime | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    root_cause_analysis: str | None = None
    resolution_notes: str | None = None
    man_hours: float | None = None
    downtime_hours: float | None = None
    operational_impact: str | None = Field(default=None, max_length=32)
    assigned_to_id: int | None = None
    is_deleted: bool | None = None


class IncidentOut(EntityBase, SoftDeleteFields):
    incident_number: str | None = None
    cabinet_id: int
    location_id: int | None = None
    severity: str | None = None
    detection_method_id: int | None = None
    failure_mode_id: int | None = None
    failure_mechanism_id: int | None = None
    failure_cause_id: int | None = None
    status: str
    occurred_at: datetime
    detected_at: datetime
    repair_started_at: datetime | None = None
    resolved_at: datetime | None = None
    title: str
    description: str | None = None
    root_cause_analysis: str | None = None
    resolution_notes: str | None = None
    man_hours: float | None = None
    downtime_hours: float | None = None
    operational_impact: str | None = None
    reported_by_id: int
    assigned_to_id: int | None = None
    # joined
    cabinet_name: str | None = None
    reported_by_username: str | None = None
    failure_mode_name: str | None = None
    failure_mechanism_name: str | None = None
    failure_cause_name: str | None = None
    detection_method_name: str | None = None


# ---------------------------------------------------------------------------
# Work Order Items
# ---------------------------------------------------------------------------

class WorkOrderItemCreate(BaseModel):
    cabinet_item_id: int | None = None
    equipment_type_id: int | None = None
    action: str = Field(max_length=20)
    quantity: int = 1
    notes: str | None = None


class WorkOrderItemOut(BaseModel):
    id: int
    work_order_id: int
    cabinet_item_id: int | None = None
    equipment_type_id: int | None = None
    action: str
    quantity: int
    notes: str | None = None
    equipment_type_name: str | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Work Orders
# ---------------------------------------------------------------------------

class WorkOrderCreate(BaseModel):
    order_type: str = Field(max_length=32)
    activity_type_id: int | None = None
    priority: str = Field(default="normal", max_length=20)
    cabinet_id: int | None = None
    incident_id: int | None = None
    plan_id: int | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    estimated_man_hours: float | None = None
    assigned_to_id: int | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    items: list[WorkOrderItemCreate] | None = None


class WorkOrderUpdate(BaseModel):
    order_type: str | None = Field(default=None, max_length=32)
    activity_type_id: int | None = None
    priority: str | None = Field(default=None, max_length=20)
    status: str | None = Field(default=None, max_length=20)
    cabinet_id: int | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    actual_start_at: datetime | None = None
    actual_end_at: datetime | None = None
    estimated_man_hours: float | None = None
    actual_man_hours: float | None = None
    assigned_to_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    completion_notes: str | None = None
    is_deleted: bool | None = None


class WorkOrderOut(EntityBase, SoftDeleteFields):
    order_number: str | None = None
    order_type: str
    activity_type_id: int | None = None
    priority: str
    status: str
    cabinet_id: int | None = None
    incident_id: int | None = None
    plan_id: int | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    actual_start_at: datetime | None = None
    actual_end_at: datetime | None = None
    estimated_man_hours: float | None = None
    actual_man_hours: float | None = None
    assigned_to_id: int | None = None
    performed_by_id: int
    title: str
    description: str | None = None
    completion_notes: str | None = None
    # joined
    cabinet_name: str | None = None
    activity_type_name: str | None = None


# ---------------------------------------------------------------------------
# Maintenance Plans
# ---------------------------------------------------------------------------

class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=50)
    equipment_category_id: int | None = None
    equipment_type_id: int | None = None
    cabinet_id: int | None = None
    interval_days: int = Field(gt=0)
    activity_type_id: int | None = None
    estimated_man_hours: float | None = None
    description: str | None = None
    next_due_date: date | None = None


class PlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=50)
    equipment_category_id: int | None = None
    equipment_type_id: int | None = None
    cabinet_id: int | None = None
    interval_days: int | None = Field(default=None, gt=0)
    activity_type_id: int | None = None
    estimated_man_hours: float | None = None
    description: str | None = None
    next_due_date: date | None = None
    is_deleted: bool | None = None


class PlanOut(EntityBase, SoftDeleteFields):
    name: str
    code: str | None = None
    equipment_category_id: int | None = None
    equipment_type_id: int | None = None
    cabinet_id: int | None = None
    interval_days: int
    activity_type_id: int | None = None
    estimated_man_hours: float | None = None
    description: str | None = None
    last_generated_date: date | None = None
    next_due_date: date | None = None
    # joined
    cabinet_name: str | None = None
    activity_type_name: str | None = None


# ---------------------------------------------------------------------------
# Operating Time
# ---------------------------------------------------------------------------

class OperatingTimeCreate(BaseModel):
    cabinet_id: int
    recorded_date: date
    operating_hours: float = Field(ge=0, le=24)
    standby_hours: float = Field(default=0, ge=0, le=24)
    downtime_hours: float = Field(default=0, ge=0, le=24)
    notes: str | None = None


class OperatingTimeUpdate(BaseModel):
    operating_hours: float | None = Field(default=None, ge=0, le=24)
    standby_hours: float | None = Field(default=None, ge=0, le=24)
    downtime_hours: float | None = Field(default=None, ge=0, le=24)
    notes: str | None = None


class OperatingTimeOut(BaseModel):
    id: int
    cabinet_id: int
    recorded_date: date
    operating_hours: float
    standby_hours: float
    downtime_hours: float
    recorded_by_id: int
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    cabinet_name: str | None = None


# ---------------------------------------------------------------------------
# Reliability analytics
# ---------------------------------------------------------------------------

class ReliabilitySummary(BaseModel):
    cabinet_id: int | None = None
    cabinet_name: str | None = None
    total_incidents: int = 0
    total_operating_hours: float = 0
    total_downtime_hours: float = 0
    mtbf_hours: float | None = None
    mttr_hours: float | None = None
    availability_pct: float | None = None


class FailureTrendPoint(BaseModel):
    period: str
    incident_count: int


class TopFailure(BaseModel):
    equipment_type_id: int
    equipment_type_name: str | None = None
    incident_count: int
