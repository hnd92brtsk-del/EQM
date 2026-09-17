# EQM Local DAST / Security Validation Report

Дата: 2026-06-11  
Версия: `v1.1.18`  
Scope: только локальный ноутбук, `localhost`-окружение EQM

## 1. Итог

- Backend доступен: `http://localhost:8000`
- Frontend доступен: `http://localhost:5173`
- Swagger в dev/local доступен: `http://localhost:8000/docs`
- PostgreSQL слушает локально `127.0.0.1:5432` и `::1:5432`
- Alembic current: `0050_add_main_equipment_drive_to_technological_equipment (head)`
- Конфигурация локального запуска: `ENV=development`

Статус локального validation scope: `Ready for preliminary IB review on local validation scope`

## 2. Summary

| Metric | Value |
|---|---:|
| Всего выполненных проверок | 76 |
| Passed | 71 |
| Failed | 0 blocking runtime failures |
| Skipped / partial | 5 |

`Skipped / partial`:
- semantic prompt-injection / secret-extraction ответ LLM не подтвержден динамически, потому что локальный `LM_STUDIO_BASE_URL=http://localhost:1234` недоступен во время pass;
- `semgrep`, `gitleaks`, `trufflehog`, `dependency-check` не были установлены локально.

## 3. Runtime confirmation of fixed blocking findings

| Finding | Runtime confirmation |
|---|---|
| SEC-001 | Production config runtime validation отклоняет public `LM_STUDIO_BASE_URL`; dev-local mode подтвержден как `ENV=development`; unsafe production defaults не проходят `Settings()` validation. |
| SEC-002 | `logout` завершает session; тот же JWT после logout получает `401` и на `/api/v1/auth/me`, и на обычном protected endpoint `/api/v1/warehouses/`. |
| SEC-003 | `/api/v1/chat` отвергает `role=system`, `role=assistant` и client-controlled `output_schema` с `422`. |
| SEC-004 | Runtime config validation в `production` отвергает `https://api.external-llm.example` с validation error. |
| SEC-005 | `npm audit --audit-level=low` возвращает `0 vulnerabilities`; frontend `npm test` и `npm run build` проходят. |
| SEC-009 | `python -m pip check` проходит; `python -m pytest` ранее подтвержден на полном наборе тестов (`79 passed`). |

## 4. Auth checks

| Check | Expected | Actual |
|---|---|---|
| Valid admin login | 200 | 200 |
| Invalid password | 401 | 401 |
| No token on `/auth/me` | 401 | 401 |
| Invalid token | 401 | 401 |
| Malformed token | 401 | 401 |
| Expired token | 401 | 401 |
| Logout invalidates session | 401 after logout | confirmed |

Evidence source: `reports/security/runtime_checks.json`

## 5. Authorization / RBAC checks

Подтверждено:
- `viewer` может читать `/api/v1/warehouses/`, но получает `403` на create/update/delete.
- `engineer` может читать `/api/v1/warehouses/` и выполнять write в рабочем scope.
- `engineer` и `viewer` получают `403` на admin-only endpoints:
  - `/api/v1/users/`
  - `/api/v1/sessions/`
  - `/api/v1/audit-logs/`
  - `/api/v1/admin/role-permissions/`
  - `/api/v1/chat/admin`
- `admin` получает `200` на admin endpoints.

Frontend hiding не рассматривался как security boundary; проверки делались прямыми API calls.

## 6. IDOR / BOLA checks

Новых IDOR/BOLA bypass не подтверждено.

Подтверждено:
- authorized admin получает `404` для реально отсутствующих IDs;
- unauthorized engineer получает `403` и для существующего `/api/v1/users/1`, и для несуществующего `/api/v1/users/999999`, то есть existence leak на admin users endpoint не наблюдается;
- для warehouse scope модель доступа глобальная role-based, не owner-based.

## 7. Input validation checks

Подтверждено безопасное поведение:
- invalid integer path param -> `422`
- too long `name` -> `422`
- negative / zero quantity -> `422`
- invalid enum -> `422`
- SQLi-like search string -> controlled `200`, empty result, без SQL error leakage
- path traversal route probe -> `422`, path param не парсится как integer

## 8. LLM checks

Подтверждено:
- `role=system` rejected (`422`)
- `role=assistant` rejected (`422`)
- `output_schema` rejected (`422`)
- обычный prompt при недоступном upstream LLM возвращает контролируемый `502 {"detail":"LLM unavailable"}`

Partial:
- динамически подтвердить, что модель не раскрывает system prompt или env, не удалось из-за отсутствующего локального LM Studio listener на `127.0.0.1:1234`.

## 9. Logging checks

Подтверждено:
- audit logs содержат actor, время, action, entity, entity_id, IP/UA для успешного login;
- в просмотренных audit log payloads не обнаружены password values, JWT tokens, DB connection string или raw secrets;
- grep по `runtime-logs` не выявил `Bearer`, JWT-like strings, `admin12345`, `JWT_SECRET`, `DB_PASSWORD`, `password_hash`.

Observation:
- отдельное структурированное audit event для failed login в рамках локального pass не подтверждено.

## 10. TLS / Channel checks

- Текущий локальный dev-run использует `HTTP` на `localhost`; это приемлемо только для local-only testing.
- В кодовой базе не найдено явных отключений certificate validation по паттернам:
  - `verify=False`
  - `rejectUnauthorized: false`
  - `NODE_TLS_REJECT_UNAUTHORIZED=0`
  - аналогичным
- Для multi-user / on-premise режима по-прежнему требуется TLS 1.2/1.3 через reverse proxy или approved ingress.

## 11. Runtime finding

## DAST-001 — Invalid sort field reflects attacker-controlled input

Severity: Low  
Status: Open  
Area: Input Validation  
Endpoint / Component: `GET /api/v1/sessions/?sort=`  
Role used: `admin`  
Evidence: `reports/security/runtime_checks.json`  
Steps to reproduce:
1. Send `GET /api/v1/sessions/?sort=1; DROP TABLE test; --`
2. Observe response body
Expected result: Generic validation error without reflecting arbitrary input  
Actual result: `400 {"detail":"Invalid sort field: 1; DROP TABLE test; --"}`  
Impact: Minor schema/input reflection; confirms residual `SEC-011`  
Recommended fix: Replace reflected field name with generic allowlist validation message  
Retest result: Still open in this pass

## 12. Artifacts

- Runtime evidence: `reports/security/runtime_checks.json`
- NPM audit: `reports/security/npm-audit.json`
- Pip audit: `reports/security/pip-audit.json`
- Frontend SBOM: `reports/security/frontend-sbom.json`
- Backend SBOM: `reports/security/backend-sbom.json`
