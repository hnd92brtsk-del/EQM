# EQM Admin Security Hardening Guide

Дата: 2026-06-11

## 1. Configuration

- Для production использовать только `ENV=production`.
- Задавать уникальные:
  - `JWT_SECRET`
  - `DB_PASSWORD`
  - `POSTGRES_SUPERUSER_PASSWORD`
  - `SEED_ADMIN_PASSWORD`
- Не использовать `ALLOW_ADMIN_PASSWORD_RESET=true` вне контролируемого maintenance window.
- Для LLM задавать только localhost/private/corporate-approved `LM_STUDIO_BASE_URL` и поддерживать `LLM_ALLOWED_HOSTS`.

## 2. Access control

- Создавать отдельные named accounts для admins; не делить один логин между операторами.
- Регулярно ревизовать:
  - `/api/v1/users/`
  - `/api/v1/sessions/`
  - `/api/v1/audit-logs/`
  - role permissions matrix
- Сразу удалять или disable temporary test users после validation work.

## 3. Local workstation use

- Для локального dev-run допускать только loopback bind addresses.
- Не пробрасывать `8000`, `5173`, `5432` наружу без отдельной задачи hardening.
- Очищать browser `localStorage` после тестов с privileged accounts.

## 4. Logging and monitoring

- Регулярно проверять audit logs на:
  - unexpected admin logins
  - user creation/deletion
  - restore operations
  - diagnostics usage
- Не включать логирование raw JWT, passwords, DB connection strings.
- Добавить отдельный контроль failed login monitoring в следующем hardening pass.

## 5. Residual hardening backlog

- `SEC-006`: add login/chat rate limiting
- `SEC-007`: disable/protect OpenAPI in production
- `SEC-008`: add central security headers
- `SEC-010`: replace `localStorage` token model if feasible
- `SEC-011`: remove reflected invalid sort field
- `SEC-012`: formalize process/guideline hardening

## 6. Before IB handoff

- Attach:
  - local DAST report
  - port matrix
  - evidence matrix
  - scan report
  - SBOM files
- Explicitly state that this pass covers local validation scope only and excludes deploy bundle / production installation.
