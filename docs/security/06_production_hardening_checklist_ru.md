# EQM Production Hardening Checklist

Дата: 2026-06-11  
Цель: on-premise production readiness checklist

## Secrets

- [ ] `JWT_SECRET` generated with cryptographically strong random value, not `change_me` or template value.
- [ ] `DB_PASSWORD` and `POSTGRES_SUPERUSER_PASSWORD` unique per environment.
- [ ] `.env` files are not committed and are readable only by deployment operators.
- [ ] Secret rotation process documented.

## Database

- [ ] Runtime DB user is not PostgreSQL superuser.
- [ ] Superuser password used only for setup/maintenance, not application runtime.
- [ ] Backups encrypted and restore tested.
- [ ] PostgreSQL exposed only to localhost/private deployment network.

## HTTPS and reverse proxy

- [ ] Production access terminates HTTPS.
- [ ] HSTS enabled when HTTPS is mandatory.
- [ ] Backend and frontend containers are not directly exposed beyond reverse proxy.
- [ ] Request size limits configured for uploads.

## CORS

- [ ] `CORS_ORIGINS` contains only approved production origins.
- [ ] Wildcard origins are not used with credentials.
- [ ] Localhost origins are removed from production unless explicitly required.

## Swagger/OpenAPI

- [ ] `/docs`, `/redoc`, `/openapi.json` disabled or admin-protected in production.
- [ ] API inventory reviewed before each release.

## JWT and sessions

- [ ] JWT secret strong and rotated on compromise.
- [ ] JWT expiration appropriate for corporate policy.
- [ ] Logout invalidates server-side session for all protected endpoints.
- [ ] Deleted users and ended sessions are rejected.

## Password policy and seed credentials

- [ ] Seed admin password changed before production.
- [ ] Production startup fails on `admin12345`.
- [ ] Password length and complexity policy documented.
- [ ] Admin password reset procedure documented.

## Logging and audit

- [ ] Logs exclude passwords, JWTs, DB connection strings and secrets.
- [ ] Prompt/response logging disabled or approved by data owner.
- [ ] Audit logs retained according to corporate policy.
- [ ] Admin diagnostics logs reviewed for sensitive data exposure.

## Deploy bundle

- [ ] Runtime/config/code changes followed by `deploy/build-offline-bundle.ps1`.
- [ ] Bundle freshness verified by `tools/check-deploy-bundle-freshness.ps1`.
- [ ] Offline bundle validated before transfer to production environment.

## Monitoring and incident response

- [ ] Failed login spikes monitored.
- [ ] Admin actions and diagnostics actions monitored.
- [ ] Dependency advisories monitored.
- [ ] Incident response contact and rollback path documented.

## LLM configuration

- [ ] `LM_STUDIO_BASE_URL` restricted to approved localhost/corporate endpoint.
- [ ] LLM endpoint isolated from internet unless explicitly approved.
- [ ] LLM prompts must not contain secrets, JWTs, passwords or uncontrolled personal data.
- [ ] Chat rate limits configured.
- [ ] LLM unavailable behavior tested.

## Network isolation

- [ ] PostgreSQL, backend and LM Studio communicate over private network only.
- [ ] Egress to unapproved LLM hosts blocked.
- [ ] Admin diagnostics endpoints available only to authorized admins and trusted network segments.
