from datetime import date, timedelta

from app.models.core import PersonnelScheduleTemplate


def test_personnel_read_access(viewer_client, db_session):
    payload = {
        "first_name": "Ivan",
        "last_name": "Petrov",
        "position": "Engineer",
        "hire_date": (date.today() - timedelta(days=400)).isoformat(),
    }
    create_response = viewer_client.post("/personnel/", json=payload)
    assert create_response.status_code == 403


def test_personnel_crud_admin(admin_client):
    payload = {
        "first_name": "Ivan",
        "last_name": "Petrov",
        "position": "Engineer",
        "hire_date": (date.today() - timedelta(days=400)).isoformat(),
    }
    create_response = admin_client.post("/personnel/", json=payload)
    assert create_response.status_code == 200
    person = create_response.json()
    assert person["tenure_years"] == 1

    update_response = admin_client.patch(
        f"/personnel/{person['id']}",
        json={"position": "Senior Engineer"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["position"] == "Senior Engineer"

    delete_response = admin_client.delete(f"/personnel/{person['id']}")
    assert delete_response.status_code == 200

    restore_response = admin_client.post(f"/personnel/{person['id']}/restore")
    assert restore_response.status_code == 200


def test_personnel_supports_schedule_template(admin_client, db_session):
    template = PersonnelScheduleTemplate(name="Graph 2", number="17", label="График 2 / №17", is_deleted=False)
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    response = admin_client.post(
        "/personnel/",
        json={
            "first_name": "Petr",
            "last_name": "Ivanov",
            "position": "Operator",
            "schedule_template_id": template.id,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["schedule_template_id"] == template.id
    assert payload["schedule_label"] == "График 2 / №17"


def test_personnel_list_viewer(viewer_client, admin_client):
    payload = {
        "first_name": "Anna",
        "last_name": "Smirnova",
        "position": "Inspector",
    }
    create_response = admin_client.post("/personnel/", json=payload)
    assert create_response.status_code == 200

    list_response = admin_client.get("/personnel/")
    assert list_response.status_code == 200
    data = list_response.json()
    assert "items" in data
    assert "total" in data


def test_training_computed_fields(admin_client):
    from app.models.core import PersonnelTraining

    training = PersonnelTraining(
        name="Safety Training",
        completion_date=(date.today() - timedelta(days=10)),
        next_due_date=(date.today() + timedelta(days=5)),
        reminder_offset_days=3,
    )
    assert training.days_until_due == 5
    assert training.days_since_completion == 10


def test_yearly_schedule_endpoints(admin_client, db_session):
    template = PersonnelScheduleTemplate(name="Graph 5", number="08", label="График 5 / №08", is_deleted=False)
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    create_response = admin_client.post(
        "/personnel/",
        json={
            "first_name": "Anna",
            "last_name": "Sidorova",
            "position": "Inspector",
            "schedule_template_id": template.id,
        },
    )
    personnel_id = create_response.json()["id"]

    status_response = admin_client.patch(
        "/personnel/schedules/yearly/statuses",
        json={
            "year": 2026,
            "operations": [
                {
                    "personnel_id": personnel_id,
                    "from_date": "2026-01-13",
                    "to_date": "2026-01-17",
                    "status": "МО",
                }
            ],
        },
    )
    assert status_response.status_code == 200
    assert len(status_response.json()) == 5

    event_response = admin_client.put(
        "/personnel/schedules/yearly/event",
        json={
            "year": 2026,
            "personnel_id": personnel_id,
            "iso_date": "2026-01-13",
            "label": "Обучение",
        },
    )
    assert event_response.status_code == 200

    get_response = admin_client.get("/personnel/schedules/yearly?year=2026")
    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["year"] == 2026
    assert payload["employees"][0]["schedule_label"] == "График 5 / №08"
    assert len(payload["assignments"]) == 5
    assert payload["events"][0]["label"] == "Обучение"

    summary_response = admin_client.get("/personnel/schedules/yearly/summary?year=2026")
    assert summary_response.status_code == 200
    summary_payload = summary_response.json()
    assert summary_payload["global"]["МО"] == 5
    assert summary_payload["employees"][str(personnel_id)]["year"]["МО"] == 5


def test_yearly_schedule_write_access_forbidden(viewer_client, admin_client):
    create_response = admin_client.post(
        "/personnel/",
        json={
            "first_name": "Elena",
            "last_name": "Kuznetsova",
            "position": "Operator",
        },
    )
    personnel_id = create_response.json()["id"]

    response = viewer_client.patch(
        "/personnel/schedules/yearly/statuses",
        json={
            "year": 2026,
            "operations": [
                {
                    "personnel_id": personnel_id,
                    "from_date": "2026-01-13",
                    "to_date": "2026-01-13",
                    "status": "МО",
                }
            ],
        },
    )
    assert response.status_code == 403
