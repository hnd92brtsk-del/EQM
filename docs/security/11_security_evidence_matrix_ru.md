# EQM Security Evidence Matrix

Дата: 2026-06-11

| Area | Evidence | Result |
|---|---|---|
| Startup | `GET /` on backend | `200 {"status":"ok"}` |
| Startup | `GET /docs` on backend | `200` |
| Startup | `GET /` on frontend | `200` |
| DB | `alembic current` | `0050_add_main_equipment_drive_to_technological_equipment (head)` |
| Auth | Valid admin login and `/auth/me` | Passed |
| Auth | Invalid password | `401` |
| Auth | Missing / invalid / malformed / expired token | `401` |
| Session invalidation | `/auth/me` and `/warehouses/` after logout | `401` |
| RBAC | `viewer` blocked from warehouse write | `403` |
| RBAC | `engineer` blocked from admin endpoints | `403` |
| RBAC | `admin` access to `/users/`, `/sessions/`, `/audit-logs/`, `/admin/role-permissions/` | `200` |
| IDOR | Unauthorized user probes on `/users/{id}` | `403` without existence leak |
| Validation | Invalid path id / long string / negative qty / invalid enum | `422` |
| Validation | SQLi-like search | Controlled `200`, no leakage |
| Validation | Invalid sort field | `400` with reflected field, confirms `SEC-011` |
| LLM | Reject `role=system` / `role=assistant` / `output_schema` | `422` |
| LLM | Normal prompt with no local LM listener | Controlled `502` |
| Logging | Audit log actor/action/entity/IP/UA present | Confirmed |
| Logging | No password/JWT/secret patterns in inspected logs | Confirmed |
| TLS/channel | No obvious certificate-verification bypass patterns in code | Confirmed |
| Ports | Frontend/backend/PostgreSQL bound to localhost | Confirmed |
| Python dependency health | `python -m pip check` | Passed |
| Python SCA | `pip-audit` | No known vulnerabilities |
| Frontend SCA | `npm audit --audit-level=low` | `0 vulnerabilities` |
| SBOM | frontend and backend SBOM generated | Done |

## Evidence files

- `reports/security/runtime_checks.json`
- `reports/security/pip-audit.json`
- `reports/security/npm-audit.json`
- `reports/security/backend-sbom.json`
- `reports/security/frontend-sbom.json`
