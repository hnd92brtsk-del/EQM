# EQM Remediation Plan

Дата: 2026-06-11  
Режим: Remediation / Fix Pass #1

## Completed in this pass

| ID | Priority | Status | Result |
|---|---|---|---|
| SEC-001 | P0 | Fixed | Production secrets, seed password and LLM endpoint config are fail-closed. |
| SEC-002 | P0 | Fixed | Universal server-side session validation added for authenticated requests. |
| SEC-003 | P1 | Fixed | LLM prompt boundary hardened; unsafe client roles/schema blocked. |
| SEC-004 | P1 | Fixed | Production LLM host allowlist/private-network checks added. |
| SEC-005 | P1 | Fixed | Frontend advisories removed with verified dependency updates. |
| SEC-009 | P1 | Fixed | Backend test execution restored and regression coverage added. |

## Remaining plan

| ID | Priority | Status | Next action |
|---|---|---|---|
| SEC-006 | P2 | Open | Add login/chat rate limiting with app or reverse-proxy enforcement. |
| SEC-007 | P2 | Open | Disable or protect `/docs`, `/redoc`, `/openapi.json` in production. |
| SEC-008 | P2 | Open | Add security headers middleware or reverse-proxy policy. |
| SEC-010 | P3 | Open | Revisit token storage architecture. |
| SEC-011 | P3 | Open | Replace reflected sort-field errors with generic validation errors. |
| SEC-012 | P3 | Open | Formalize persistent security review/process guidance. |

## Verification completed

- `python -m pip check`
- `python -m pytest`
- `npm audit --audit-level=low`
- `npm test`
- `npm run build`

## Deployment follow-up

- `python tools\bump_version.py` completed: version updated to `v1.1.18`
- `powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1` failed due missing local Docker runtime/base image
- `powershell -ExecutionPolicy Bypass -File .\tools\check-deploy-bundle-freshness.ps1` could not pass because bundle was not produced
