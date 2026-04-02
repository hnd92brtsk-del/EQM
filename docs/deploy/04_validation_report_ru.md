# EQM Offline Deploy Validation Report

## Сводка

- Версия bundle: `v1.0.3`
- Bundle path: `deploy/dist/eqm-offline-bundle`
- Свежий dump: `backup/equipment_crm_deploy.sql`
- Alembic revision dump: `0043_add_io_signal_plc_range_fields`
- Точное число строк в snapshot: `4722`
- Table counts report: `backup/equipment_crm_deploy_table_counts.tsv`
- Enum and dictionary report: `backup/equipment_crm_deploy_enums.txt`

## Локальная Docker-валидация

Выполнен полный локальный runtime-check из готовых tar-образов без пересборки из исходников:

- загружены `postgres-16.tar`, `eqm-backend-1.0.3.tar`, `eqm-frontend-1.0.3.tar`
- поднят validation stack через `deploy/dist/eqm-offline-bundle/deploy/app/docker-compose.yml`
- восстановлен dump `backup/equipment_crm_deploy.sql`
- backend health: `200`
- backend docs: `200`
- frontend root: `200`
- вход под `admin` успешен
- file download smoke-check через `/api/v1/cabinet-files/{id}/download`: `200`

Итоговый compose status во время успешной проверки:

- `eqm-postgres` healthy
- `eqm-backend` healthy
- `eqm-frontend` healthy

Дополнительно подтверждены данные после restore:

- `equipment_types`: `1377`
- `audit_logs`: `1000`

## Тесты

Backend:

- `54` passed
- `1` failed

Оставшийся failing test:

- `backend/tests/test_ipam_service.py::test_validate_subnet_cidr_rejects_unsupported_prefix`

Причина: текущая реализация IPAM уже не запрещает этот prefix, а тест всё ещё ожидает `HTTPException`. Это несовпадение теста и актуального поведения, не регрессия offline-deploy.

Frontend:

- `4` test files passed
- `16` tests passed

Production build:

- frontend production build выполнен успешно и использован для сборки `eqm/frontend:v1.0.3`

## Размеры

- Source payload excluding `.git`, `.venv`, `deploy/dist`, pytest caches: `324.14 MB`
- Offline bundle size: `263.17 MB`

Bundle меньше исходника, и это ожидаемо. В offline bundle не включаются:

- `.git`
- `.venv`
- `frontend/node_modules`
- локальные test/build caches
- локальные временные каталоги разработки

При этом в bundle включены обязательные deploy-артефакты:

- runtime Docker image tar files
- свежий SQL dump
- counts/enums reports
- production deploy configs
- постоянные файловые данные проекта

## Runtime Images

- `deploy/runtime-images/postgres-16.tar`: `165938688` bytes
- `deploy/runtime-images/eqm-backend-1.0.3.tar`: `76492800` bytes
- `deploy/runtime-images/eqm-frontend-1.0.3.tar`: `18395648` bytes