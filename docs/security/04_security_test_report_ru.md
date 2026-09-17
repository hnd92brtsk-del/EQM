# EQM Security Test Report

Дата: 2026-06-11

## Command results

| Command | Result | Notes |
|---|---|---|
| `.\.venv\Scripts\python -m pip check` | Passed | `No broken requirements found.` |
| `.\.venv\Scripts\python -m pytest` from `backend` | Passed | `79 passed` |
| `npm audit --audit-level=low` from `frontend` | Passed after fix | Initial run found 9 vulnerabilities; after `npm audit fix` result is `found 0 vulnerabilities`. |
| `npm audit fix` from `frontend` | Passed | Updated lockfile and vulnerable transitive packages. |
| `npm test` from `frontend` | Passed | `7` test files, `22` tests passed. |
| `npm run build` from `frontend` | Passed | Production build completed on Vite `7.3.5`. |
| `.\.venv\Scripts\python tools\bump_version.py` | Passed | Version updated to `v1.1.18`. |
| `powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1` | Failed | Local Docker runtime unavailable; `postgres:16` base image not available locally; script also reported Alembic revision mismatch during preflight output. |
| `powershell -ExecutionPolicy Bypass -File .\tools\check-deploy-bundle-freshness.ps1` | Failed | `deploy/dist/eqm-offline-bundle` not found because bundle build did not complete. |

## Security regression coverage added

- `backend/tests/test_security_config_and_seed.py`
  - production rejects default JWT secret
  - production rejects weak JWT secret
  - production rejects default seed password
  - production accepts localhost and allowlisted LLM host
  - production rejects public/invalid LLM URL
  - production seed does not reset existing admin password without explicit flag
- `backend/tests/test_auth_sessions_online.py`
  - valid token works before logout
  - `/auth/me` returns 401 after logout
  - protected endpoint returns 401 after logout
  - missing session, чужой session, hash mismatch all return 401
- `backend/tests/test_chat_security.py`
  - `role=system` rejected
  - `role=assistant` rejected
  - client-controlled `output_schema` rejected
  - normal user prompt passes and server system prompt is injected
- `frontend/src/api/chat.test.ts`
  - only user messages are sent to backend
- `frontend/src/components/ChatDialog.test.tsx`
  - model output containing HTML/script-like text is rendered as plain text

## Additional verification notes

- Full backend suite initially exposed one unrelated failing IPAM test. Root cause was missing subnet-prefix validation in `backend/app/services/ipam.py`; this was corrected and the full suite now passes.
- No checks were skipped for backend/frontend unit and integration verification.
- Bundle rebuild/freshness checks are environment-blocked and remain a manual follow-up after restoring local Docker/base images.

## Local DAST validation addendum

Authorized local validation was executed against:

- `http://localhost:8000`
- `http://localhost:5173`
- local PostgreSQL on `127.0.0.1:5432`

Artifacts:

- `reports/security/runtime_checks.json`
- `docs/security/09_local_dast_validation_report_ru.md`
- `docs/security/10_socket_port_matrix_ru.md`
- `docs/security/11_security_evidence_matrix_ru.md`

Key runtime confirmations:

- auth/session/logout controls from `SEC-002` work at runtime;
- LLM role/schema boundary from `SEC-003` is enforced at request validation layer;
- production LLM allowlist validation from `SEC-004` rejects public URL;
- no blocking runtime regression was found for fixed `SEC-001` to `SEC-005`, `SEC-009`.
