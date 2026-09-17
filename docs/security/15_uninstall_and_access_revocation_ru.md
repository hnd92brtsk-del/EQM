# EQM Uninstall and Access Revocation

Дата: 2026-06-11

## 1. Immediate access revocation

- Logout active EQM sessions from the UI.
- Delete temporary validation users through admin API/UI.
- If needed, rotate:
  - `JWT_SECRET`
  - admin passwords
  - DB passwords
  - optional LLM API key
- Clear browser `localStorage` key used for EQM token on the workstation.

## 2. Stop local services

Recommended order:

1. Stop frontend dev server.
2. Stop backend uvicorn process.
3. Stop local PostgreSQL if it is dedicated to the test environment.

## 3. Local data cleanup

Review and remove, if the environment is being decommissioned:

- project virtual environment `.venv`
- frontend dependencies `frontend/node_modules`
- local upload/storage directories created for testing
- generated reports under `reports/security`
- temporary runtime logs

Do not delete shared corporate datasets or non-test PostgreSQL clusters.

## 4. Test artifact cleanup

- Remove temporary test users and temporary test records created during validation.
- Preserve sanitized security evidence under `docs/security` and `reports/security` if the package is needed for IB review.

## 5. Revoke optional integrations

If optional local/corporate LLM integration was enabled:

- revoke test API key if one was used
- restore approved `LM_STUDIO_BASE_URL`
- clear any temporary allowlist entries

## 6. Administrative closure checklist

- Temporary users removed
- Temporary sessions invalidated
- Temporary records deleted
- Secrets rotated if exposed
- Browser token cleared
- Local services stopped
- Evidence package archived or intentionally deleted
