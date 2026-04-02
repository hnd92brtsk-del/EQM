# EQM: эксплуатация, обновление и резервное копирование

## 1. Ежедневные команды

```bash
cd /opt/eqm/eqm-offline-bundle/deploy/app
docker compose --env-file .env ps
docker compose --env-file .env logs postgres --tail=100
docker compose --env-file .env logs backend --tail=100
docker compose --env-file .env logs frontend --tail=100
```

## 2. Перезапуск сервисов

```bash
cd /opt/eqm/eqm-offline-bundle/deploy/app
docker compose --env-file .env restart postgres
docker compose --env-file .env restart backend
docker compose --env-file .env restart frontend
```

Перезапуск всего стека:

```bash
docker compose --env-file .env restart
sudo systemctl reload nginx
```

## 3. Повторное восстановление БД

```bash
cd /opt/eqm/eqm-offline-bundle/deploy/app
./restore-db.sh ../../backup/equipment_crm_deploy.sql
docker compose --env-file .env restart backend frontend
```

## 4. Ручной backup БД

```bash
mkdir -p /opt/eqm/backups/manual
docker compose --env-file /opt/eqm/eqm-offline-bundle/deploy/app/.env -f /opt/eqm/eqm-offline-bundle/deploy/app/docker-compose.yml exec -T postgres \
  pg_dump -U equipment_user -d equipment_crm > /opt/eqm/backups/manual/equipment_crm_$(date +%F_%H-%M-%S).sql
```

## 5. Ручной backup файлов

```bash
mkdir -p /opt/eqm/backups/files
tar -czf /opt/eqm/backups/files/eqm_files_$(date +%F_%H-%M-%S).tar.gz \
  /srv/eqm/photo \
  /srv/eqm/datasheets \
  /srv/eqm/uploads \
  /srv/eqm/cabinet-files \
  /srv/eqm/pid-storage
```

## 6. Обновление новой версией bundle

На исходной машине:

1. Обновить `main`
2. Снова выполнить `deploy/build-offline-bundle.ps1`
3. Перенести новый `eqm-offline-bundle` на сервер

На сервере:

```bash
cd /opt/eqm/eqm-offline-bundle/deploy/app
./load-images.sh
docker compose --env-file .env up -d postgres
./restore-db.sh ../../backup/equipment_crm_deploy.sql
docker compose --env-file .env up -d backend frontend
sudo nginx -t && sudo systemctl reload nginx
```

## 7. Откат

Если новый bundle оказался нерабочим:

1. Вернуть предыдущий рабочий bundle
2. Снова загрузить его образы `./load-images.sh`
3. Восстановить предыдущий SQL backup
4. Поднять backend/frontend

## 8. Мини-чеклист после обновления

```bash
cd /opt/eqm/eqm-offline-bundle/deploy/app
docker compose --env-file .env ps
curl -I http://127.0.0.1:18000/health
curl -I http://127.0.0.1:18080/
curl -I http://127.0.0.1/
sudo nginx -t
```

И в браузере:

- открывается страница логина
- работает вход под `admin`
- открываются данные
- скачиваются вложения
- нет critical-ошибок в логах
