# EQM SAST / SCA / Secrets Scan Report

Дата: 2026-06-11

## 1. Executed tools

| Tool / Command | Status | Result |
|---|---|---|
| `.\.venv\Scripts\python -m pip check` | Executed | Passed |
| `.\.venv\Scripts\python -m pip_audit -r backend\requirements.txt -f json -o reports/security/pip-audit.json` | Executed | No known vulnerabilities |
| `npm audit --audit-level=low --json > reports/security/npm-audit.json` | Executed | `0 vulnerabilities` |
| `npm sbom --sbom-format cyclonedx --json > reports/security/frontend-sbom.json` | Executed | Passed |
| `.\.venv\Scripts\cyclonedx-py requirements backend\requirements.txt -o reports/security/backend-sbom.json` | Executed | Passed with warnings about unpinned versions in `requirements.txt` |

## 2. Unavailable tools

| Tool | Status | Suggested install command |
|---|---|---|
| `semgrep` | Skipped, not installed | `python -m pip install semgrep` |
| `gitleaks` | Skipped, not installed | install from official binary release |
| `trufflehog` | Skipped, not installed | `python -m pip install trufflehog` or official binary |
| `dependency-check` | Skipped, not installed | install OWASP Dependency-Check CLI |

## 3. Supplemental heuristic secret grep

Heuristic grep hit:
- placeholders in `backend/.env.example`, `deploy/app/.env.example`
- local/dev values in `backend/.env`
- deploy validation/build scripts under `deploy/` and `tools/`

Interpretation:
- No confirmed runtime leak of JWTs/passwords/DB connection strings was found in inspected app logs.
- Deploy/offline bundle scripts were outside scope for this local pass and are not escalated here as blocking issues.

## 4. SBOM notes

- `frontend-sbom.json` generated successfully.
- `backend-sbom.json` generated successfully.
- Backend SBOM tool warned that many backend requirements are not pinned to exact versions; this is a supply-chain hygiene observation, not a blocking runtime issue for this pass.

## 5. Artifacts

- `reports/security/pip-audit.json`
- `reports/security/npm-audit.json`
- `reports/security/backend-sbom.json`
- `reports/security/frontend-sbom.json`
