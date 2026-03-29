# Подготовка offline-bundle для сервера без интернета

## Что такое offline-bundle

`offline-bundle` — это комплект файлов, который вы готовите на машине с интернетом, а потом переносите на локальные серверы без интернета.

В комплект должны входить:

- Docker-образы EQM;
- Docker-образ PostgreSQL;
- файлы `docker-compose.yml`, `.env`, `nginx.conf`;
- документация по развёртыванию;
- дамп базы данных;
- архивы пользовательских файлов;
- `AppImage` LM Studio;
- заранее скачанная модель `phi3-mini-4k-instruct`;
- при необходимости пакет `.deb` для offline-установки Docker Engine.

## Что подготовить на ноутбуке

Работайте из корня проекта:

```powershell
cd d:\dev\prj\EQM
```

Создайте каталог под offline-bundle:

```powershell
New-Item -ItemType Directory -Force -Path deploy\offline-bundle | Out-Null
New-Item -ItemType Directory -Force -Path deploy\offline-bundle\images | Out-Null
New-Item -ItemType Directory -Force -Path deploy\offline-bundle\data | Out-Null
New-Item -ItemType Directory -Force -Path deploy\offline-bundle\llm | Out-Null
```

## Сборка Docker-образов приложения

Соберите backend:

```powershell
docker build -f deploy/app/Dockerfile.backend -t eqm/backend:1.0.0 .
```

Соберите frontend + nginx:

```powershell
docker build -f deploy/app/Dockerfile.frontend-nginx --build-arg VITE_API_URL=/api/v1 -t eqm/frontend-nginx:1.0.0 .
```

Загрузите официальный PostgreSQL образ:

```powershell
docker pull postgres:16
```

## Сохранение Docker-образов в `.tar`

```powershell
docker save -o deploy/offline-bundle/images/eqm-backend_1.0.0.tar eqm/backend:1.0.0
docker save -o deploy/offline-bundle/images/eqm-frontend-nginx_1.0.0.tar eqm/frontend-nginx:1.0.0
docker save -o deploy/offline-bundle/images/postgres_16.tar postgres:16
```

## Копирование deployment-файлов

```powershell
Copy-Item deploy\app\docker-compose.yml deploy\offline-bundle\
Copy-Item deploy\app\.env.example deploy\offline-bundle\.env.example
Copy-Item deploy\app\nginx.conf deploy\offline-bundle\
```

## Подготовка дампа базы данных

Если локальная база уже запущена, создайте свежий dump:

```powershell
$env:PGPASSWORD = "change_me"
pg_dump -h localhost -p 5432 -U equipment_user -d equipment_crm -Fc -f deploy/offline-bundle/data/equipment_crm.dump
Remove-Item Env:PGPASSWORD
```

Если свежий dump сейчас сделать нельзя, положите в offline-bundle актуальный резервный файл:

```powershell
Copy-Item backup\equipment_crm.sql deploy\offline-bundle\data\
```

## Подготовка архива файловых данных

Нужно перенести не только БД, но и файловые каталоги проекта:

- `Photo`
- `Datasheets`
- `backend/uploads`
- `backend/storage/cabinet_files`
- `backend/app/pid_storage`

Соберите архив:

```powershell
tar -czf deploy/offline-bundle/data/eqm_files.tar.gz Photo Datasheets backend/uploads backend/storage/cabinet_files backend/app/pid_storage
```

## Подготовка LM Studio и модели

Для LLM-сервера заранее подготовьте:

- файл `LM-Studio-*.AppImage`;
- каталог загруженной модели `phi3-mini-4k-instruct`;
- текстовый файл с точным model id, если он уже известен.

Рекомендуемая структура:

```text
deploy/offline-bundle/llm/
├─ LM-Studio.AppImage
├─ models/
└─ model-id.txt
```

Если точный `model id` ещё неизвестен, это нормально. Его можно узнать уже на сервере командой:

```bash
curl http://eqm-llm-01:1234/v1/models
```

## Подготовка офлайн-установки Docker Engine

Если app-сервер будет полностью без интернета, заранее скачайте `.deb` пакеты для `Ubuntu Server 24.04 LTS`.

На отдельной машине с Ubuntu 24.04:

```bash
mkdir -p ~/docker-offline
cd ~/docker-offline
apt download docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Скопируйте полученные `.deb` файлы в:

```text
deploy/offline-bundle/docker-debs/
```

## Что в итоге должно получиться

Финальная структура bundle:

```text
deploy/offline-bundle/
├─ images/
│  ├─ eqm-backend_1.0.0.tar
│  ├─ eqm-frontend-nginx_1.0.0.tar
│  └─ postgres_16.tar
├─ data/
│  ├─ equipment_crm.dump  или equipment_crm.sql
│  └─ eqm_files.tar.gz
├─ llm/
│  ├─ LM-Studio.AppImage
│  ├─ models/
│  └─ model-id.txt
├─ docker-debs/
├─ docker-compose.yml
├─ nginx.conf
└─ .env.example
```

После этого bundle можно переносить на серверы через:

- внешний SSD;
- флешку;
- локальную внутреннюю сеть;
- `scp`;
- WinSCP.
