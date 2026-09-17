# EQM Residual Risks

Дата: 2026-06-11  
Статус after Fix Pass #1: residual P2/P3 items remain

## Open risks

| ID | Risk | Required control |
|---|---|---|
| SEC-006 | Brute force or chat resource exhaustion | Add app/proxy rate limiting and quotas |
| SEC-007 | OpenAPI exposure in production | Disable or protect docs endpoints |
| SEC-008 | Missing central security headers | Add backend or reverse-proxy header policy |
| SEC-010 | JWT theft if XSS appears elsewhere | Consider HttpOnly cookie model or stronger browser protections |
| SEC-011 | Minor API schema disclosure via invalid sort errors | Return generic validation error |
| SEC-012 | Security process drift | Add/maintain explicit security engineering guidance |

Runtime reconfirmation:

- `SEC-011` was reproduced during local validation on `GET /api/v1/sessions/?sort=1; DROP TABLE test; --`, which returned `400` with reflected field name.

## Environment residuals

| Area | Residual issue | Impact |
|---|---|---|
| Offline bundle rebuild | Local Docker runtime/base image unavailable | Bundle freshness cannot be re-certified in this workstation state |
| Deploy preflight | Bundle script reported Alembic revision mismatch (`expected 0043...`, got `0050...`) | Requires deploy pipeline follow-up before release packaging |

## Risk statement

Blocking P0/P1 findings from the security review are closed. The project is suitable for internal security review, but not for claims of complete security. Remaining P2/P3 issues and deploy-environment gaps still need scheduled follow-up.
