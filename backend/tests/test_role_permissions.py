from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user, get_db
from app.core.log_retention import enforce_table_row_limit
from app.models.sessions import UserSession
from app.routers import role_permissions as role_permissions_router


def make_app(db_session, user):
    app = FastAPI()
    app.include_router(role_permissions_router.router, prefix="/api/v1/admin/role-permissions")

    def _get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: user
    return app


def test_can_create_custom_role_and_update_matrix(db_session, users):
    client = TestClient(make_app(db_session, users["admin"]))

    create_response = client.post(
        "/api/v1/admin/role-permissions/roles",
        json={"key": "dispatcher", "label": "Dispatcher"},
    )
    assert create_response.status_code == 200
    assert create_response.json()["key"] == "dispatcher"

    matrix_response = client.get("/api/v1/admin/role-permissions")
    assert matrix_response.status_code == 200
    payload = matrix_response.json()
    assert any(role["key"] == "dispatcher" for role in payload["roles"])

    update_response = client.put(
        "/api/v1/admin/role-permissions",
        json={
            "permissions": [
                {
                    "role": "dispatcher",
                    "space_key": "overview",
                    "can_read": True,
                    "can_write": False,
                    "can_admin": False,
                }
            ]
        },
    )
    assert update_response.status_code == 200

    updated_payload = update_response.json()
    dispatcher_permission = next(
        item
        for item in updated_payload["permissions"]
        if item["role"] == "dispatcher" and item["space_key"] == "overview"
    )
    assert dispatcher_permission["can_read"] is True
    assert dispatcher_permission["can_write"] is False
    assert dispatcher_permission["can_admin"] is False


def test_log_retention_hard_deletes_old_rows(db_session, users):
    db_session.add_all(
        [
            UserSession(user_id=users["admin"].id, session_token_hash=f"token-{index}")
            for index in range(1002)
        ]
    )
    db_session.flush()
    enforce_table_row_limit(db_session, UserSession, max_rows=1000)
    db_session.commit()

    sessions = db_session.query(UserSession).order_by(UserSession.id.asc()).all()
    assert len(sessions) == 1000
    assert sessions[0].session_token_hash == "token-2"
