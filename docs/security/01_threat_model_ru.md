# EQM Threat Model

Дата: 2026-06-11  
Режим: audit-only

## Assets

| Asset | Security properties |
|---|---|
| User accounts and roles | Authentication, authorization, integrity |
| JWT access tokens and sessions | Confidentiality, revocation semantics |
| Equipment, warehouse, cabinet, I/O and maintenance data | Integrity, availability, auditability |
| Personnel data and schedule data | Confidentiality, integrity |
| Audit logs and session logs | Integrity, retention, non-repudiation |
| PostgreSQL database | Confidentiality, integrity, availability |
| Uploaded files and diagrams | Integrity, malware/file handling boundary |
| LLM prompts/responses | Confidentiality, prompt boundary, data minimization |
| Deployment secrets | Confidentiality, rotation, production safety |

## Actors

| Actor | Capability |
|---|---|
| Anonymous network user | Can reach public frontend/API paths exposed by deployment |
| Authenticated viewer | Read access to work spaces by role/space permissions |
| Authenticated engineer | Write access to work spaces, no admin spaces by default |
| Admin | User/session/audit/diagnostics/admin permissions |
| Internal attacker | May know default credentials, inspect network, abuse weak config |
| Compromised browser/session | Can replay bearer token until rejected/expired |
| Misconfigured LLM endpoint | Can receive prompts/responses outside expected trust boundary |

## Trust boundaries

| Boundary | Notes |
|---|---|
| Browser to FastAPI API | Bearer JWT in `Authorization`; frontend role checks are not security boundary |
| FastAPI to PostgreSQL | Runtime DB user should be least privilege; superuser password only for setup |
| FastAPI to filesystem | Upload/download and PID storage require path and type controls |
| FastAPI to LM Studio | High-risk LLM data boundary; must be local/corporate allowlisted |
| Reverse proxy to backend/frontend | Security headers, HTTPS, CORS and exposure control |
| Deployment env files | Secrets boundary; placeholders must fail closed in production |

## Data flows

| Flow | Description | Main risks |
|---|---|---|
| Login | User posts username/password, backend verifies hash, creates session, returns JWT | Brute force, default credentials, weak JWT secret |
| Authenticated API | Browser sends JWT to protected routers | Token replay after logout, RBAC gaps, BOLA/IDOR |
| File upload/download | Engineer uploads photos/datasheets/cabinet files | Type spoofing, size abuse, sensitive file exposure |
| Audit logging | Backend stores before/after/meta data | Sensitive data in logs, incomplete coverage |
| LLM chat | User messages proxied to LM Studio | Prompt injection, data leakage, SSRF-like misrouting |
| Deployment | `.env` and scripts configure DB, JWT, CORS, runtime URLs | Insecure defaults, exposed docs, weak secrets |

## Auth and RBAC model

Backend uses JWT bearer tokens and server-side `UserSession` records. Role helpers include `require_read_access`, `require_write_access`, `require_admin`, and `require_space_access`. UI permission hiding is not sufficient; backend dependencies are the enforcement point. Manual endpoint review found broad use of backend dependencies, but session invalidation is incomplete because regular API auth does not validate active session state.

## LLM-specific trust boundary

`/api/v1/chat` and `/api/v1/chat/admin` proxy to configured LM Studio. The LLM is not a trusted enforcement point. It must not receive secrets, JWTs, passwords, unrestricted DB exports or role-protected data outside the caller's authorization. Current design accepts client-controlled `system` messages and `output_schema`, and does not constrain `LM_STUDIO_BASE_URL` to approved hosts.

## STRIDE analysis

| STRIDE | Top risks |
|---|---|
| Spoofing | Default admin credentials, weak/default JWT secret, replayed JWT after logout |
| Tampering | Engineer/write endpoints can modify business data; session invalidation gap can permit replay |
| Repudiation | Audit logs exist, but logout semantics are incomplete and test coverage is blocked |
| Information disclosure | OpenAPI exposure, LLM external misrouting, localStorage token exposure after XSS |
| Denial of service | Missing login/chat rate limits, LLM resource exhaustion, dependency ReDoS advisories |
| Elevation of privilege | Default admin seed, weak JWT secret, frontend dependency exploitability in dev/CI |

## Top risks

1. Production default credentials/secrets can lead to admin compromise.
2. Logout does not revoke tokens for normal API calls.
3. LLM boundary is not hardened against system-role injection and misconfigured external endpoint.
4. Critical/high frontend dependency advisories affect build/dev trust.
5. Security test execution is currently blocked in backend environment.
