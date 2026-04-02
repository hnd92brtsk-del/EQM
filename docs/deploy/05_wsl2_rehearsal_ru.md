# EQM WSL2 Rehearsal Deploy

## Назначение

Этот сценарий нужен для локальной репетиции Linux-деплоя на `WSL2`, максимально близкой к целевому `Ubuntu Server 24.04`.

Используется уже собранный offline bundle:

- `deploy/dist/eqm-offline-bundle`

Репетиция поднимает внутри `WSL2`:

- native `docker` engine
- `nginx` на хосте Ubuntu
- `PostgreSQL`, `backend`, `frontend` из готовых tar-образов bundle
- отдельный Python venv для backend maintenance

## Что делает helper-скрипт

Скрипт [wsl2-rehearse-deploy.ps1](/d:/dev/prj/EQM/tools/wsl2-rehearse-deploy.ps1):

- проверяет наличие WSL-дистрибутива `Ubuntu-24.04`
- устанавливает в Ubuntu пакеты `python3`, `python3-venv`, `nginx`, `curl`, `docker.io`, `docker-compose-v2`
- включает `docker` и `nginx`
- копирует bundle в Linux FS:
  - `/opt/eqm/eqm-offline-bundle`
- подготавливает Linux-каталоги:
  - `/srv/eqm/photo`
  - `/srv/eqm/datasheets`
  - `/srv/eqm/uploads`
  - `/srv/eqm/cabinet-files`
  - `/srv/eqm/pid-storage`
  - `/srv/eqm/postgres`
- переключает копию `.env` на `http://localhost`
- запускает `deploy/app/deploy.sh` внутри WSL
- настраивает host `nginx`
- создаёт venv:
  - `/opt/eqm/venvs/eqm-backend`
- ставит backend requirements в этот venv
- выполняет smoke-check:
  - `GET /health`
  - `GET /docs`
  - `GET /`
  - login под `admin`
  - проверка `alembic_version`
  - точный row count по всем таблицам
  - file download через API

## Быстрый запуск

Из корня репозитория в Windows PowerShell:

```powershell
.\tools\wsl2-rehearse-deploy.ps1
```

Если bundle лежит в другом месте:

```powershell
.\tools\wsl2-rehearse-deploy.ps1 -BundleRoot "deploy/dist/eqm-offline-bundle"
```

Если нужен другой WSL-дистрибутив:

```powershell
.\tools\wsl2-rehearse-deploy.ps1 -DistroName "Ubuntu-24.04"
```

## Что получилось в текущей репетиции

Фактическая проверка в `Ubuntu-24.04` прошла успешно:

- `http://localhost/health` -> `200`
- `http://localhost/docs` -> `200`
- `http://localhost/` -> `200`
- login под `admin` успешен
- `alembic_version` -> `0043_add_io_signal_plc_range_fields`
- точный суммарный объём данных после smoke-check -> `4727` строк в `42` таблицах
- file download через API -> `200`

Ключевые справочники и связанные таблицы присутствуют:

- `access_spaces` -> `10`
- `role_definitions` -> `3`
- `role_space_permissions` -> `30`
- `measurement_units` -> `105`
- `signal_types` -> `18`
- `field_equipments` -> `36`
- `data_types` -> `31`
- `main_equipment` -> `130`
- `equipment_categories` -> `367`
- `manufacturers` -> `201`
- `digital_twin_documents` -> `2`
- `network_topology_documents` -> `3`
- `serial_map_documents` -> `7`
- `personnel_yearly_schedule_assignments` -> `226`
- `personnel_yearly_schedule_events` -> `0`

Файловые каталоги в WSL также заполнены:

- `/srv/eqm/photo` -> `5` файлов
- `/srv/eqm/datasheets` -> `4` файла
- `/srv/eqm/uploads` -> `1` файл
- `/srv/eqm/cabinet-files` -> `2` файла
- `/srv/eqm/pid-storage` -> `2` файла

## Почему row count стал 4727

Изначальный deploy dump был снят с live-базы с baseline `4722` строки.

Во время WSL smoke-check счётчик вырос до `4727`, потому что проверка:

- создала новые `user_sessions` при логине `admin`
- добавила тестовую запись `cabinet_files`, чтобы гарантированно проверить download через API на изолированной WSL-копии

Это изменение относится только к WSL rehearsal runtime и не меняет исходный deploy dump в репозитории.

## Как проверить вручную после запуска

Внутри WSL:

```bash
docker compose --env-file /opt/eqm/eqm-offline-bundle/deploy/app/.env \
  -f /opt/eqm/eqm-offline-bundle/deploy/app/docker-compose.yml ps

curl http://127.0.0.1/health
curl -I http://127.0.0.1/docs
curl -I http://127.0.0.1/
```

Из Windows:

```powershell
Invoke-WebRequest http://localhost/
```

## Важная заметка по WSL

Во время первой настройки WSL возможно несколько коротких restart-cycle у `docker.service` сразу после установки пакетов и включения сервиса. В текущей репетиции это наблюдалось как transient-событие на этапе инициализации окружения, а не как ошибка приложения.

Если такое повторится:

1. дождитесь, пока `systemctl status docker` покажет стабильный `active (running)`
2. перепроверьте:

```bash
curl http://127.0.0.1/health
docker compose --env-file /opt/eqm/eqm-offline-bundle/deploy/app/.env \
  -f /opt/eqm/eqm-offline-bundle/deploy/app/docker-compose.yml ps
```

После стабилизации `docker.service` runtime работает штатно.
