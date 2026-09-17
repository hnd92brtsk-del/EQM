# EQM Security Findings Register

Дата: 2026-06-11  
Версия проекта: v1.1.18  
Статус готовности: Ready for internal security review with residual P2/P3 items

## Fixed findings

### SEC-001 - Production-опасные defaults секретов и seed admin

Severity: Critical  
Status: Fixed

Evidence:
- `backend/app/core/config.py`: added `ENV` normalization, production-only validation for `JWT_SECRET`, `DB_PASSWORD`, `POSTGRES_SUPERUSER_PASSWORD`, `SEED_ADMIN_PASSWORD`, `LM_STUDIO_BASE_URL`.
- `backend/scripts/seed.py`: production seed no longer silently resets existing admin password; reset requires `ALLOW_ADMIN_PASSWORD_RESET=true`; weak production seed password is rejected.
- `backend/.env.example`, `deploy/app/.env.example`: placeholders documented as development-only and new flags added.
- Tests: `backend/tests/test_security_config_and_seed.py`

### SEC-002 - Logout не инвалидирует токены для обычных API-запросов

Severity: High  
Status: Fixed

Evidence:
- `backend/app/core/dependencies.py`: `get_current_user()` now requires `session_id`, checks `UserSession.user_id`, `ended_at is None`, and `session_token_hash == hash_token(token)`.
- `backend/app/routers/auth.py`: logout and heartbeat validate the same bound session/token pair.
- Tests: `backend/tests/test_auth_sessions_online.py`

### SEC-003 - LLM proxy допускал client-controlled system messages и schema steering

Severity: High  
Status: Fixed

Evidence:
- `backend/app/routers/chat.py`: request roles reduced to `role=user`; server always injects the system prompt; client `output_schema` is rejected.
- `frontend/src/api/chat.ts`: only user messages are sent back to the backend.
- `frontend/src/components/ChatDialog.test.tsx`: HTML/script-like response remains plain text in UI.
- Tests: `backend/tests/test_chat_security.py`, `frontend/src/api/chat.test.ts`, `frontend/src/components/ChatDialog.test.tsx`

### SEC-004 - LLM base URL lacked allowlist and network boundary validation

Severity: High  
Status: Fixed

Evidence:
- `backend/app/core/config.py`: production accepts only localhost, private IPs, or hosts from `LLM_ALLOWED_HOSTS`.
- `backend/.env.example`, `deploy/app/.env.example`: `LLM_ALLOWED_HOSTS` documented.
- Tests: `backend/tests/test_security_config_and_seed.py`

### SEC-005 - Frontend dependency vulnerabilities

Severity: High  
Status: Fixed

Evidence:
- `frontend/package-lock.json`: controlled dependency upgrades via `npm audit fix`.
- Verified by `npm audit --audit-level=low`, `npm test`, `npm run build`.

### SEC-009 - Backend tests blocked in current environment

Severity: Medium  
Status: Fixed

Evidence:
- `python -m pip check` now passes in project venv.
- `python -m pytest` now passes: 79 tests passed.
- Added security regression coverage for `SEC-001` to `SEC-004`.

## Open findings

| ID | Severity | Status | Note |
|---|---|---|---|
| SEC-006 | Medium | Open | No login/chat rate limiting yet. |
| SEC-007 | Medium | Open | OpenAPI/Swagger production control not yet added. |
| SEC-008 | Medium | Open | Security headers are not centrally enforced. |
| SEC-010 | Low | Open | JWT is still stored in localStorage. |
| SEC-011 | Low | Open | Invalid sort field still echoes field name. |
| SEC-012 | Info | Open | Process/guideline hardening remains pending. |
