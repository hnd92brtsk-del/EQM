# EQM: типовые проблемы при офлайн-деплое и способы решения

## 1. `docker load` не видит tar-файлы

Причины:

- bundle скопирован не полностью
- tar-файлы повреждены
- запускается не тот каталог

Решение:

```bash
ls -lh /opt/eqm/eqm-offline-bundle/deploy/runtime-images
cd /opt/eqm/eqm-offline-bundle/deploy/app
./load-images.sh
```

## 2. `postgres` не становится healthy

Причины:

- нет прав на host data dir PostgreSQL
- в `.env` занят порт `15432`
- повреждён старый data dir

Решение:

```bash
docker compose --env-file .env logs postgres --tail=200
grep HOST_POSTGRES_DATA_DIR .env
sudo mkdir -p /opt/eqm/data/postgres
sudo chown -R $USER:$USER /opt/eqm/data/postgres
ss -ltnp | grep 15432 || true
```

Если нужен чистый запуск:

```bash
rm -rf /opt/eqm/data/postgres/*
docker compose --env-file .env up -d postgres
```

## 3. `restore-db.sh` падает на SQL

Причины:

- используется не свежий dump
- dump повреждён при копировании
- БД уже в частично восстановленном состоянии

Решение:

```bash
ls -lh ../../backup/equipment_crm_deploy.sql
head -n 20 ../../backup/equipment_crm_deploy.sql
./restore-db.sh ../../backup/equipment_crm_deploy.sql
```

Скрипт уже чистит `public schema` перед восстановлением, поэтому повторный запуск допустим.

## 4. `backend` unhealthy

Причины:

- миграции не применились
- не работает подключение к БД
- неверный `.env`

Решение:

```bash
docker compose --env-file .env logs backend --tail=200
curl -I http://127.0.0.1:18000/health
docker compose --env-file .env exec -T postgres psql -U equipment_user -d equipment_crm -c "select version_num from alembic_version;"
```

## 5. Сайт открывается, но вход не работает

Причины:

- пароль `admin` ожидается не тот, что в `.env`
- backend не дошёл до bootstrap после старта
- frontend смотрит не в тот API

Решение:

```bash
grep SEED_ADMIN_PASSWORD .env
docker compose --env-file .env logs backend --tail=200
curl http://127.0.0.1:18000/health
```

Пароль `admin` при старте backend приводится к значению `SEED_ADMIN_PASSWORD`.

## 6. Swagger работает, но в UI нет данных

Причины:

- dump не восстановлен
- восстановлен старый дамп
- frontend открывает пустую БД

Решение:

```bash
docker compose --env-file .env exec -T postgres psql -U equipment_user -d equipment_crm -c "\dt"
docker compose --env-file .env exec -T postgres psql -U equipment_user -d equipment_crm -c "select count(*) from equipment_types;"
docker compose --env-file .env exec -T postgres psql -U equipment_user -d equipment_crm -c "select count(*) from audit_logs;"
```

## 7. Файлы не скачиваются

Причины:

- пустые host-каталоги данных
- неверные пути в `.env`
- права на файловые каталоги

Решение:

```bash
grep -E "HOST_PHOTO_DIR|HOST_DATASHEET_DIR|HOST_UPLOAD_DIR|HOST_CABINET_FILES_DIR|HOST_PID_STORAGE_ROOT" .env
ls -la /opt/eqm/data/photo
ls -la /opt/eqm/data/datasheets
ls -la /opt/eqm/data/uploads
ls -la /opt/eqm/data/cabinet-files
ls -la /opt/eqm/data/pid-storage
```

## 8. Host nginx не проксирует приложение

Причины:

- конфиг не скопирован
- остался default-site
- ошибка в nginx config

Решение:

```bash
sudo nginx -t
sudo ls -la /etc/nginx/sites-enabled
curl -I http://127.0.0.1:18080/
curl -I http://127.0.0.1:18000/health
sudo systemctl reload nginx
```

## 9. Bundle меньше исходника `main`

Это не обязательно ошибка.

Нормальные причины:

- в bundle не включаются `.git`
- в bundle не включается `.venv`
- убраны локальные кэши, логи, тестовые артефакты, `node_modules`, локальные build-каталоги

Плохая причина только одна:

- случайно не попали SQL dump, runtime images или каталоги постоянных данных

Проверка:

```bash
ls -lh /opt/eqm/eqm-offline-bundle/backup
ls -lh /opt/eqm/eqm-offline-bundle/deploy/runtime-images
```
