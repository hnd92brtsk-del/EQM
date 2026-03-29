# Резервное копирование и восстановление

## Что нужно резервировать

Нужно резервировать два контура:

1. **PostgreSQL**
2. **Файловые каталоги**

Если резервировать только БД, вы потеряете вложенные файлы.

## Каталоги, которые входят в резервную копию

```text
/srv/eqm-data/postgres        # только для аварийного образа тома, не как основной способ
/srv/eqm-data/photo
/srv/eqm-data/datasheets
/srv/eqm-data/uploads
/srv/eqm-data/cabinet-files
/srv/eqm-data/pid
```

## Основной способ резервного копирования БД

Создайте каталог под бэкапы:

```bash
sudo mkdir -p /srv/eqm-backups/db
sudo mkdir -p /srv/eqm-backups/files
sudo chown -R $USER:$USER /srv/eqm-backups
```

Сделайте dump:

```bash
docker exec eqm-postgres pg_dump -U equipment_user -d equipment_crm -Fc -f /tmp/equipment_crm.dump
docker cp eqm-postgres:/tmp/equipment_crm.dump /srv/eqm-backups/db/equipment_crm_$(date +%F_%H-%M).dump
docker exec eqm-postgres rm -f /tmp/equipment_crm.dump
```

## Резервное копирование файлов

```bash
tar -czf /srv/eqm-backups/files/eqm_files_$(date +%F_%H-%M).tar.gz \
  /srv/eqm-data/photo \
  /srv/eqm-data/datasheets \
  /srv/eqm-data/uploads \
  /srv/eqm-data/cabinet-files \
  /srv/eqm-data/pid
```

## Рекомендуемая периодичность

Для вашего сценария достаточно:

- БД: **ежедневно**
- файлы: **ежедневно**
- хранение: **минимум 7 последних копий**

## Пример простого cron

Откройте cron:

```bash
crontab -e
```

Пример:

```cron
30 1 * * * docker exec eqm-postgres pg_dump -U equipment_user -d equipment_crm -Fc -f /tmp/equipment_crm.dump && docker cp eqm-postgres:/tmp/equipment_crm.dump /srv/eqm-backups/db/equipment_crm_$(date +\%F_\%H-\%M).dump && docker exec eqm-postgres rm -f /tmp/equipment_crm.dump
0 2 * * * tar -czf /srv/eqm-backups/files/eqm_files_$(date +\%F_\%H-\%M).tar.gz /srv/eqm-data/photo /srv/eqm-data/datasheets /srv/eqm-data/uploads /srv/eqm-data/cabinet-files /srv/eqm-data/pid
```

## Восстановление из резервной копии БД

```bash
docker cp /srv/eqm-backups/db/equipment_crm_2026-03-28_01-30.dump eqm-postgres:/tmp/restore.dump
docker exec -it eqm-postgres pg_restore -U equipment_user -d equipment_crm --clean --if-exists /tmp/restore.dump
docker exec eqm-postgres rm -f /tmp/restore.dump
```

## Восстановление файлов

```bash
tar -xzf /srv/eqm-backups/files/eqm_files_2026-03-28_02-00.tar.gz -C /
```

Если не хотите распаковывать поверх существующих данных, сначала распакуйте во временный каталог:

```bash
mkdir -p /opt/eqm-restore
tar -xzf /srv/eqm-backups/files/eqm_files_2026-03-28_02-00.tar.gz -C /opt/eqm-restore
```

И затем восстановите выборочно через `rsync`.

## Что делать после восстановления

После восстановления:

```bash
cd /opt/eqm
docker compose restart backend
docker compose restart nginx
docker compose exec backend alembic upgrade head
```

Проверьте:

```bash
curl http://127.0.0.1/health
docker compose ps
docker compose logs backend --tail=100
```

## Минимальная проверка восстановления

Восстановление считается успешным, если:

- frontend открывается;
- вход в систему работает;
- ключевые записи видны в интерфейсе;
- файлы открываются;
- чат с LLM продолжает работать.
