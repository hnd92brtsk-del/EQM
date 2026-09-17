# EQM Socket / Port Matrix

Дата: 2026-06-11  
Scope: только локальные процессы EQM

## Фактическая матрица

| Port | Proto | Bind address | Component | PID / Process | Initiator | Purpose | Outbound | Security notes |
|---|---|---|---|---|---|---|---|---|
| 5173 | TCP | `127.0.0.1` | Frontend Vite dev server | `12044 / node.exe` | Browser -> frontend | Local UI/dev websocket | No required external outbound | Localhost-only listener |
| 8000 | TCP | `127.0.0.1` | FastAPI backend | `1064 / python.exe (uvicorn --reload)` | Frontend/browser -> backend | API and Swagger in dev | Backend may initiate DB/LLM connections | Localhost-only listener |
| 5432 | TCP | `127.0.0.1`, `::1` | PostgreSQL | `19680 / postgres.exe` | Backend worker -> DB | Local application database | No external outbound required | Localhost/loopback only |
| 1234 | TCP | not listening | Optional LM Studio | not present during pass | Backend -> optional LLM | Local LLM proxy target | Optional outbound from backend | Absent in this pass; chat returned controlled `502` |

## Verified process details

- Backend launcher:
  - PID `1064`
  - Command line: `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
- Backend worker with DB connections:
  - PID `8632`
  - Python multiprocessing child of uvicorn reloader
  - Observed `ESTABLISHED` connections from `::1:*` to `::1:5432`
- Frontend:
  - PID `12044`
  - `node.exe`
- PostgreSQL:
  - PID `19680`
  - listens on `127.0.0.1:5432` and `::1:5432`

## Security interpretation

- EQM components in current local setup are bound to loopback only.
- Network exposure to other hosts was not observed for frontend/backend/DB.
- Observed server-initiated connections are limited to:
  - backend worker -> local PostgreSQL
  - optional backend -> local/corporate-approved LLM endpoint if configured
- Public outbound LLM URL is rejected by production config validation.

## Notes

- Other listening Windows system ports from the host OS were visible in `netstat`, but they are outside EQM scope and were not assessed here.
- Local HTTP without TLS is acceptable only because the pass is strictly limited to a single laptop and loopback interfaces.
