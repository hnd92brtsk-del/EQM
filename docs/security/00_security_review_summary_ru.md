# EQM Security Review Summary

## Purpose

Этот pass закрывает blocking findings из audit-only review и фиксирует фактические результаты remediation.

## Review metadata

| Field | Value |
|---|---|
| Дата | 2026-06-11 |
| Проект | EQM |
| Версия до remediation | v1.1.17 |
| Версия после remediation | v1.1.18 |
| Режим | Remediation / Fix Pass #1 |
| Итоговый статус | Ready for internal security review with residual P2/P3 items |

## Fixed in this pass

| ID | Status | Summary |
|---|---|---|
| SEC-001 | Fixed | Production config переведен в fail-closed режим для секретов, seed admin и LLM boundary settings. |
| SEC-002 | Fixed | Все authenticated requests теперь валидируют активную server-side session и hash токена. |
| SEC-003 | Fixed | Chat API принимает только `role=user`; client-controlled `output_schema` запрещен. |
| SEC-004 | Fixed | Production `LM_STUDIO_BASE_URL` ограничен localhost/private host или `LLM_ALLOWED_HOSTS`. |
| SEC-005 | Fixed | Frontend dependencies обновлены; `npm audit --audit-level=low` проходит без advisory. |
| SEC-009 | Fixed | Backend environment синхронизирован; `pip check` и полный `pytest` проходят. |

## Residual open findings

Открыты только non-blocking items: `SEC-006`, `SEC-007`, `SEC-008`, `SEC-010`, `SEC-011`, `SEC-012`.

## Key evidence

- Backend changes: `backend/app/core/config.py`, `backend/app/core/dependencies.py`, `backend/app/core/security.py`, `backend/app/routers/auth.py`, `backend/app/routers/chat.py`, `backend/scripts/seed.py`
- Frontend changes: `frontend/src/api/chat.ts`, `frontend/package-lock.json`
- Regression tests: `backend/tests/test_security_config_and_seed.py`, `backend/tests/test_auth_sessions_online.py`, `backend/tests/test_chat_security.py`, `frontend/src/api/chat.test.ts`, `frontend/src/components/ChatDialog.test.tsx`
- Verification: `python -m pip check`, `python -m pytest`, `npm audit --audit-level=low`, `npm test`, `npm run build`

## Deploy/bundle note

Build version bumped to `v1.1.18`. Offline bundle rebuild and freshness verification remain blocked in the current workstation environment because Docker is unavailable locally and the required base runtime image `postgres:16` is not present. This is recorded in the security test report as an environment limitation, not as an open P0/P1 code issue.
