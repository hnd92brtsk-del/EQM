from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select

from app.core.dependencies import get_db, get_current_user, oauth2_scheme
from app.core.security import verify_password, create_access_token, hash_token, decode_token
from app.core.audit import add_audit_log, model_to_dict
from app.models.security import User
from app.models.sessions import UserSession
from app.schemas.auth import LoginIn, TokenOut
from app.schemas.users import UserOut

router = APIRouter()


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db=Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or user.is_deleted:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    session = UserSession(
        user_id=user.id,
        session_token_hash="pending",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(session)
    db.flush()

    token = create_access_token(user.username, user.id, user.role.value, session.id)
    session.session_token_hash = hash_token(token)
    user.last_login_at = datetime.utcnow()

    add_audit_log(
        db,
        actor_id=user.id,
        action="LOGIN",
        entity="users",
        entity_id=user.id,
        before=None,
        after=model_to_dict(user),
        meta={"ip": session.ip_address, "ua": session.user_agent},
    )

    db.commit()

    return TokenOut(
        access_token=token,
        user=UserOut(
            id=user.id,
            username=user.username,
            role=user.role.value,
            created_at=user.created_at,
            updated_at=user.updated_at,
            is_deleted=user.is_deleted,
            deleted_at=user.deleted_at,
        ),
    )


@router.post("/logout")
def logout(
    token: str = Depends(oauth2_scheme),
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    payload = decode_token(token)
    session_id = payload.get("session_id")
    if session_id:
        session = db.scalar(select(UserSession).where(UserSession.id == session_id))
        if session and not session.ended_at:
            session.ended_at = datetime.utcnow()
            session.end_reason = "logout"

    add_audit_log(
        db,
        actor_id=user.id,
        action="LOGOUT",
        entity="users",
        entity_id=user.id,
        before=None,
        after=None,
    )
    db.commit()
    return {"status": "ok"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role.value,
        created_at=user.created_at,
        updated_at=user.updated_at,
        is_deleted=user.is_deleted,
        deleted_at=user.deleted_at,
    )
