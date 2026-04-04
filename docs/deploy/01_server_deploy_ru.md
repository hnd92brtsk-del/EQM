# EQM: офлайн-развёртывание на Ubuntu Server 24.04.4 LTS

## 1. Что входит в offline bundle

Важно:

- Любые изменения проекта теперь обязаны сопровождаться актуализацией offline bundle.
- Если изменились код, БД, dump, Docker-образы, env, deploy-скрипты, runtime-пути, nginx-конфиги или инструкция по развёртыванию, перед переносом на сервер нужно заново пересобрать:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1
```

- Перед переносом bundle на сервер дополнительно проверьте его свежесть:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\check-deploy-bundle-freshness.ps1
```

- Отдельный релизный чеклист лежит в `docs/deploy/06_bundle_release_checklist_ru.md`.

После запуска:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1
```

появляется каталог:

```text
deploy\dist\eqm-offline-bundle
```

В нём находятся:

- `deploy/runtime-images/*.tar` — готовые Docker images
- `deploy/app/docker-compose.yml` — runtime stack
- `deploy/app/portainer-stack.yml` — stack для Portainer
- `deploy/app/.env` — готовый production env
- `deploy/app/nginx.host.conf` — конфиг host nginx
- `deploy/app/load-images.sh`
- `deploy/app/restore-db.sh`
- `deploy/app/deploy.sh`
- `backup/equipment_crm_deploy.sql` — свежий полный dump БД
- `backup/equipment_crm_deploy_table_counts.tsv`
- `backup/equipment_crm_deploy_enums.txt`
- постоянные файловые данные: `Photo`, `Datasheets`, `backend/uploads`, `backend/storage/cabinet_files`, `backend/app/pid_storage`

## 2. Целевое окружение

- Ubuntu Server `24.04.4 LTS`
- Linux kernel `6.8.0-106-generic`
- Docker `29.3.1`
- nginx `1.24.0-2ubuntu7.6`
- Portainer `2.39.1 LTS`
- адрес сервера: `192.168.110.18`

Публичная точка входа:

- `http://192.168.110.18`

Важно:

- WSL-репетиция не потребовала изменений в серверной сетевой схеме
- проблемы вида `localhost`, Windows proxy и удержание WSL в активном состоянии относятся только к локальной репетиции на ПК
- для реального Ubuntu-сервера это не нужно
- полезное улучшение после репетиции только одно: в bundle теперь нужно использовать более длинный `JWT_SECRET`

## 3. Что копировать на сервер

На сервер копируется именно каталог:

```text
eqm-offline-bundle
```

Его можно положить, например, сюда:

```text
/opt/eqm/eqm-offline-bundle
```

## 4. Подготовка каталогов на сервере

```bash
sudo mkdir -p /opt/eqm
sudo mkdir -p /opt/eqm/data/photo
sudo mkdir -p /opt/eqm/data/datasheets
sudo mkdir -p /opt/eqm/data/uploads
sudo mkdir -p /opt/eqm/data/cabinet-files
sudo mkdir -p /opt/eqm/data/pid-storage
sudo mkdir -p /opt/eqm/data/postgres
sudo chown -R $USER:$USER /opt/eqm
```

## 5. Загрузка образов без интернета

```bash
cd /opt/eqm/eqm-offline-bundle/deploy/app
chmod +x load-images.sh restore-db.sh deploy.sh
./load-images.sh
```

Проверка:

```bash
docker images | grep -E "eqm/backend|eqm/frontend|postgres"
```

## 6. Production env

В bundle уже есть готовый файл:

```text
deploy/app/.env
```

По умолчанию он настроен на:

- `PUBLIC_BASE_URL=http://192.168.110.18`
- `JWT_SECRET` с длиной больше 32 символов
- `POSTGRES_DATA_DIR=/var/lib/postgresql/data`
- `HOST_POSTGRES_DATA_DIR=/opt/eqm/data/postgres`
- `HOST_PHOTO_DIR=/opt/eqm/data/photo`
- `HOST_DATASHEET_DIR=/opt/eqm/data/datasheets`
- `HOST_UPLOAD_DIR=/opt/eqm/data/uploads`
- `HOST_CABINET_FILES_DIR=/opt/eqm/data/cabinet-files`
- `HOST_PID_STORAGE_ROOT=/opt/eqm/data/pid-storage`

При необходимости отредактируйте:

```bash
nano /opt/eqm/eqm-offline-bundle/deploy/app/.env
```

Рекомендуется проверить, что:

- `PUBLIC_BASE_URL`, `FRONTEND_PUBLIC_URL`, `BACKEND_PUBLIC_URL` указывают на `http://192.168.110.18`
- `JWT_SECRET` не короче 32 символов
- `SEED_ADMIN_PASSWORD` установлен в тот пароль, который вы реально хотите использовать для первого входа

## 7. Первый запуск стека

```bash
cd /opt/eqm/eqm-offline-bundle/deploy/app
docker compose --env-file .env up -d postgres
```

Проверка:

```bash
docker compose --env-file .env ps
docker compose --env-file .env logs postgres --tail=100
```

## 8. Восстановление свежего dump

```bash
cd /opt/eqm/eqm-offline-bundle/deploy/app
./restore-db.sh ../../backup/equipment_crm_deploy.sql
```

Проверка:

```bash
docker compose --env-file .env exec -T postgres psql -U equipment_user -d equipment_crm -c "\dt"
```

## 9. Старт backend и frontend

```bash
cd /opt/eqm/eqm-offline-bundle/deploy/app
docker compose --env-file .env up -d backend frontend
```

Проверка:

```bash
docker compose --env-file .env ps
docker compose --env-file .env logs backend --tail=150
docker compose --env-file .env logs frontend --tail=150
```

## 10. Настройка host nginx

```bash
sudo cp /opt/eqm/eqm-offline-bundle/deploy/app/nginx.host.conf /etc/nginx/sites-available/eqm.conf
sudo ln -sf /etc/nginx/sites-available/eqm.conf /etc/nginx/sites-enabled/eqm.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 11. Smoke-check

С сервера:

```bash
curl -I http://127.0.0.1:18000/health
curl -I http://127.0.0.1:18080/
curl -I http://127.0.0.1/
curl http://127.0.0.1/health
```

Из браузера:

- `http://192.168.110.18/`
- `http://192.168.110.18/docs`

## 12. Данные входа для первой проверки

По умолчанию bundle собирается с логином:

- логин: `admin`
- пароль: значение `SEED_ADMIN_PASSWORD` из `deploy/app/.env`

Backend при старте идемпотентно сбрасывает пароль пользователя `admin` на это значение, поэтому вход после restore предсказуем.

## 13. Полный автоматизированный сценарий

Если все пути и `.env` уже верны:

```bash
cd /opt/eqm/eqm-offline-bundle/deploy/app
./deploy.sh ../../backup/equipment_crm_deploy.sql
```

После этого останется только включить host nginx.
