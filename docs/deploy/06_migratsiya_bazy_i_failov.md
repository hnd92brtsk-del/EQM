# Миграция базы данных и файлов на сервер

## Что нужно перенести

Обязательно переносите **и БД, и файловые каталоги**.

Нужно мигрировать:

- PostgreSQL база `equipment_crm`
- `Photo/`
- `Datasheets/`
- `backend/uploads/`
- `backend/storage/cabinet_files/`
- `backend/app/pid_storage/diagrams/`
- `backend/app/pid_storage/images/`

Если перенести только БД, часть вложений и изображений будет потеряна.

## Вариант 1. Основной способ: свежий dump

### Шаг 1. Создать dump на ноутбуке

В PowerShell:

```powershell
cd d:\dev\prj\EQM
$env:PGPASSWORD = "change_me"
pg_dump -h localhost -p 5432 -U equipment_user -d equipment_crm -Fc -f backup\equipment_crm.dump
Remove-Item Env:PGPASSWORD
```

### Шаг 2. Собрать архив файлов

```powershell
tar -czf backup\eqm_files.tar.gz Photo Datasheets backend/uploads backend/storage/cabinet_files backend/app/pid_storage
```

### Шаг 3. Перенести файлы на `eqm-app-01`

Перенесите:

- `backup/equipment_crm.dump`
- `backup/eqm_files.tar.gz`

в каталог:

```text
/opt/eqm-import
```

## Вариант 2. Запасной способ: готовый SQL-файл

Если у вас уже есть актуальный:

```text
backup/equipment_crm.sql
```

его можно использовать вместо `pg_dump`.

Важно: использовать этот путь можно только если файл действительно свежий.

## Восстановление БД на сервере

### Шаг 1. Убедиться, что PostgreSQL контейнер запущен

```bash
cd /opt/eqm
docker compose ps
```

### Шаг 2. Восстановление из `.dump`

```bash
docker cp /opt/eqm-import/equipment_crm.dump eqm-postgres:/tmp/equipment_crm.dump
docker exec -it eqm-postgres pg_restore -U equipment_user -d equipment_crm --clean --if-exists /tmp/equipment_crm.dump
```

### Шаг 3. Восстановление из `.sql`, если используете SQL-файл

```bash
docker cp /opt/eqm-import/equipment_crm.sql eqm-postgres:/tmp/equipment_crm.sql
docker exec -i eqm-postgres psql -U equipment_user -d equipment_crm -f /tmp/equipment_crm.sql
```

## Восстановление файловых каталогов

### Шаг 1. Распаковать архив

```bash
mkdir -p /opt/eqm-import/unpack
tar -xzf /opt/eqm-import/eqm_files.tar.gz -C /opt/eqm-import/unpack
```

### Шаг 2. Разложить файлы по боевым каталогам

```bash
rsync -av /opt/eqm-import/unpack/Photo/ /srv/eqm-data/photo/
rsync -av /opt/eqm-import/unpack/Datasheets/ /srv/eqm-data/datasheets/
rsync -av /opt/eqm-import/unpack/backend/uploads/ /srv/eqm-data/uploads/
rsync -av /opt/eqm-import/unpack/backend/storage/cabinet_files/ /srv/eqm-data/cabinet-files/
rsync -av /opt/eqm-import/unpack/backend/app/pid_storage/ /srv/eqm-data/pid/
```

Проверьте:

```bash
find /srv/eqm-data/photo -type f | head
find /srv/eqm-data/datasheets -type f | head
find /srv/eqm-data/uploads -type f | head
find /srv/eqm-data/cabinet-files -type f | head
find /srv/eqm-data/pid -type f | head
```

## После восстановления обязательно выполнить миграции

Даже если dump создан недавно, backend должен привести схему к актуальному состоянию:

```bash
cd /opt/eqm
docker compose exec backend alembic upgrade head
```

Проверьте текущую ревизию:

```bash
cd /opt/eqm
docker compose exec backend alembic current
```

## Проверка количества записей

Пример проверки:

```bash
docker exec -it eqm-postgres psql -U equipment_user -d equipment_crm -c "select count(*) from users;"
docker exec -it eqm-postgres psql -U equipment_user -d equipment_crm -c "select count(*) from equipment_types;"
docker exec -it eqm-postgres psql -U equipment_user -d equipment_crm -c "select count(*) from manufacturers;"
docker exec -it eqm-postgres psql -U equipment_user -d equipment_crm -c "select count(*) from cabinets;"
```

Сравните эти значения с источником.

## Проверка файлов после миграции

После входа в приложение проверьте:

- открывается карточка с фото оборудования;
- скачивается datasheet;
- открывается cabinet file;
- отображаются изображения PID;
- открываются вложения персонала.

## Минимальный чек-лист успешной миграции

Миграция успешна, если:

- БД восстановлена без ошибок;
- `alembic current` показывает актуальную ревизию;
- основные таблицы имеют ожидаемое количество записей;
- файлы доступны из интерфейса;
- backend не пишет ошибки о missing file.
