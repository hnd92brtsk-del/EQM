from datetime import date, timedelta


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


def test_personnel_list_viewer(viewer_client, admin_client):
    payload = {
        "first_name": "Anna",
        "last_name": "Smirnova",
        "position": "Inspector",
    }
    create_response = admin_client.post("/personnel/", json=payload)
    assert create_response.status_code == 200

    list_response = viewer_client.get("/personnel/")
    assert list_response.status_code == 200
    data = list_response.json()
    assert data["total"] >= 1


def test_training_computed_fields(admin_client):
    person_response = admin_client.post(
        "/personnel/",
        json={"first_name": "Olga", "last_name": "Ivanova", "position": "Technician"},
    )
    assert person_response.status_code == 200
    person_id = person_response.json()["id"]

    payload = {
        "name": "Safety Training",
        "completion_date": (date.today() - timedelta(days=10)).isoformat(),
        "next_due_date": (date.today() + timedelta(days=5)).isoformat(),
        "reminder_offset_days": 3,
    }
    training_response = admin_client.post(f"/personnel/{person_id}/trainings", json=payload)
    assert training_response.status_code == 200
    training = training_response.json()
    assert training["days_until_due"] == 5
    assert training["days_since_completion"] == 10
