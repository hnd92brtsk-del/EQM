# EQM LLM Security Assessment

Дата: 2026-06-11  
Endpoint scope: `/api/v1/chat`, `/api/v1/chat/admin`

## Current security posture

`SEC-003` and `SEC-004` are fixed in this pass.

## Implemented controls

- Client request schema accepts only `role=user`.
- Server injects the application system prompt itself.
- Client-controlled `output_schema` is rejected.
- Frontend sends only user messages back to the backend.
- Frontend chat output remains plain text; no HTML rendering is introduced in the dialog.
- In production `LM_STUDIO_BASE_URL` must resolve to:
  - `localhost` / loopback
  - private network IP
  - or host explicitly listed in `LLM_ALLOWED_HOSTS`

## Data boundary

Users must not place the following into LLM prompts:

- secrets or passwords
- JWT or bearer tokens
- database exports or raw dumps
- personal data without approval
- internal incident data or privileged diagnostics beyond approved business need

The approved endpoint must be local or corporate-approved. Public external LLM URLs are rejected by config validation in production.

## Verification

- Backend tests: `backend/tests/test_chat_security.py`
- Config tests: `backend/tests/test_security_config_and_seed.py`
- Frontend tests: `frontend/src/api/chat.test.ts`, `frontend/src/components/ChatDialog.test.tsx`

## Residual risk

Prompt injection remains an inherent model-behavior risk even after role/schema hardening. Rate limiting, approved-host operations, user guidance, and infrastructure logging controls are still required and tracked as residual items.
