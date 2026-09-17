# EQM: Architecture / Threats / Ports Brief for IB

Дата: 2026-06-11  
Scope: локальное validation-окружение на ноутбуке

## 1. Схема взаимодействия

- Client:
  - Browser на Windows workstation
  - Frontend: React + Vite dev server
- Channel:
  - `http://localhost:5173` -> `http://localhost:8000`
  - loopback-only, без внешней сети
- Server/runtime:
  - FastAPI + Uvicorn на Windows
  - Backend bound to `127.0.0.1:8000`
- DB:
  - PostgreSQL 16
  - loopback `127.0.0.1:5432` / `::1:5432`
- Optional LLM:
  - backend proxy to `LM_STUDIO_BASE_URL`
  - в текущем pass локальный listener на `127.0.0.1:1234` отсутствовал

## 2. Краткая модель угроз

- External attacker:
  - в локальном loopback scope прямой удаленный доступ не подтвержден;
  - для server/on-prem mode риск повышается при network exposure.
- Insider / authorized misuse:
  - актуален для admin endpoints, audit visibility, user/session management.
- Traffic interception:
  - в локальном pass минимален из-за loopback;
  - для multi-user deployment нужен TLS 1.2/1.3.
- Compromised browser/session:
  - остается residual риск из-за JWT в `localStorage`.
- Misconfigured LLM endpoint:
  - mitigated в code: production config rejects public non-allowlisted LLM hosts.

## 3. Socket / port matrix

| Port | Protocol | Bind | Component | Initiator | Purpose | Outbound | Notes |
|---|---|---|---|---|---|---|---|
| 5173 | TCP | `127.0.0.1` | Frontend Vite | Browser | Local UI | No | loopback only |
| 8000 | TCP | `127.0.0.1` | FastAPI backend | Frontend/browser | API + docs in dev | Backend -> DB / optional LLM | loopback only |
| 5432 | TCP | `127.0.0.1`, `::1` | PostgreSQL | Backend worker | DB access | No | loopback only |
| 1234 | TCP | not listening | optional LM Studio | Backend | optional LLM proxy | Yes, optional | absent in this pass |

## 4. Authentication and Authorization

- Bearer JWT authentication is used.
- Runtime checks confirmed:
  - valid login works;
  - invalid / malformed / expired / missing token returns `401`;
  - logout invalidates the server-side session and the same JWT stops working.
- Authorization is enforced server-side:
  - `viewer` blocked from write operations;
  - `engineer` blocked from admin-only endpoints;
  - `admin` allowed on admin endpoints.
- Frontend role hiding was not treated as a security control; direct API probes were used.

## 5. TLS / channel security

- Current local validation uses plain HTTP on `localhost`; this is acceptable only for single-laptop loopback testing.
- For corporate multi-user / on-prem operation:
  - terminate TLS 1.2/1.3 at reverse proxy / ingress;
  - restrict backend/frontend exposure to approved interfaces;
  - disable or protect dev-only surfaces.
- No obvious code patterns disabling certificate verification were found during grep review.

## 6. Input validation

Validated runtime behavior:
- invalid IDs -> `422`
- invalid enum / negative or zero quantity -> `422`
- long strings -> `422`
- SQLi-like search strings did not trigger backend leakage
- path traversal route probe was rejected at route validation layer

Known residual:
- invalid sort field still reflects attacker-controlled field name in `400` response (`SEC-011`).

## 7. Logging

- Audit logs contain actor, timestamp, action, entity, entity id, IP and user-agent for successful login/admin actions.
- Inspected logs did not expose passwords, JWTs, DB connection strings or raw secrets.
- Dedicated structured evidence for failed login auditing was not confirmed in this pass and should be reviewed in future hardening.

## 8. Self-audit / scanning

- SAST:
  - `semgrep` not installed locally; skipped
- SCA:
  - `pip check` passed
  - `pip-audit` found no known vulnerabilities
  - `npm audit --audit-level=low` returned `0 vulnerabilities`
- Secrets scan:
  - `gitleaks` / `trufflehog` not installed locally; skipped
  - supplemental heuristic grep found only placeholders/dev values and deploy-script artifacts, not a confirmed live secret disclosure in app runtime scope
- SBOM:
  - frontend CycloneDX SBOM generated
  - backend CycloneDX SBOM generated

## 9. Secure lifecycle / CI-CD notes

- Isolated build status:
  - local backend/frontend test and build checks passed
  - deploy bundle was intentionally out of scope for this pass
- Code signing status:
  - not validated / no code-signing evidence collected in local scope
- Uninstall / access revocation:
  - documented separately in `docs/security/15_uninstall_and_access_revocation_ru.md`

## 10. Recommendation

Для локального validation scope проект можно передавать на предварительный диалог с ИБ со статусом:

`Ready for preliminary IB review on local validation scope`

Это не является заявлением о полной production readiness, потому что server deployment bundle, reverse proxy TLS posture и installation hardening были вне scope текущего pass.
