# EQM — Equipment Management Web Application

## О проекте
EQM — веб-приложение для учета и управления оборудованием автоматизации, складскими и шкафными позициями, I/O сигналами и перемещениями. Проект ориентирован на локальное (on-premise) развертывание.

## Стек
- PostgreSQL 16.3
- FastAPI (Python 3.12.10), SQLAlchemy 2.x, Alembic
- React 18 + Vite, MUI, TanStack Query/Table, Recharts
- Node.js 24.12.0, npm 11.6.2

## Основные возможности
- RBAC роли: admin / engineer / viewer
- Справочники: manufacturers, locations, equipment_types, warehouses, cabinets
- Учет складских и шкафных позиций: warehouse_items, cabinet_items
- Перемещения оборудования: inbound, transfer, to_cabinet, from_cabinet, writeoff, adjustment
- Учет I/O сигналов для шкафных компонентов
- Аудит действий и сессии пользователей
- Дашборд с метриками

## Структура проекта
```
EQM/
├─ Architecture.md          # Подробная архитектура/ТЗ
├─ Checklist.md             # Чек-лист проверки
├─ backend/                 # FastAPI + SQLAlchemy + Alembic
├─ docs/                    # Документация и developer notes
├─ frontend/                # Vite + React + MUI
├─ README.md                # Этот файл
└─ START_PROMPT_FOR_CODEX v1.0.md
```

## Developer Notes
- [Nomenclature Selects Rule](docs/DeveloperNote_NomenclatureSelects.md) — обязательное правило для всех UI-списков и фильтров, использующих номенклатуру `equipment_types`.

## Быстрый старт (Windows PowerShell)

### 1) Виртуальное окружение
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Если PowerShell блокирует скрипты:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
Если не хотите менять policy, используйте `npm.cmd` вместо `npm`.

### 2) Зависимости backend
```powershell
pip install -r backend\requirements.txt
```

### 3) Настройка окружения
Скопируйте шаблон и заполните пароли:
```powershell
Copy-Item backend\.env.example backend\.env
```

### 4) Создание БД и пользователя
```powershell
python backend\scripts\create_database.py
```

### 5) Миграции
```powershell
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
cd ..
```

### 6) Seed-данные
```powershell
python backend\scripts\seed.py
```

### 7) Запуск backend
```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host localhost --port 8000
```
Backend будет доступен: `http://localhost:8000`

### 8) Запуск frontend
Откройте новое окно PowerShell:
```powershell
cd frontend
npm.cmd install
npm.cmd run dev -- --host localhost --port 5173
```
Frontend будет доступен: `http://localhost:5173`

Frontend работает только из корня сайта `/`, без подкаталогов вроде `/EQM`.

### 9) Локальный запуск через PowerShell
Ручной запуск:
```powershell
pg_ctl -D .postgres\data -l .postgres\postgres.log start
```
```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host localhost --port 8000
```
```powershell
cd frontend
npm.cmd install
npm.cmd run dev -- --host localhost --port 5173
```

### 10) One-click локальный запуск
Из корня проекта можно использовать:
```powershell
.\start-local.ps1
```

Остановка локального окружения:
```powershell
.\stop-local.ps1
```

Этот сценарий:
- использует только `localhost`
- поднимает локальный PostgreSQL cluster из `.postgres\data`
- запускает backend на `http://localhost:8000`
- запускает frontend на `http://localhost:5173`
- убирает конфликтующие dev-процессы EQM на портах `8000` и `5173`

Если нужно добавить `.venv\Scripts` в пользовательский PATH Windows:
```powershell
.\setup-local-path.ps1
```
После этого откройте новый PowerShell.

### 11) Низкоуровневые скрипты
Из корня проекта можно использовать:
```powershell
.\start-backend.ps1
.\start-frontend.ps1
```
Эти скрипты тоже работают только на `localhost`.

## Локальная БД
- Канонический локальный PostgreSQL cluster лежит в `.postgres\data`
- Скрипты запуска не создают новый cluster автоматически; они используют существующий
- Для автозапуска Postgres бинарники (`pg_ctl`, `postgres`, `psql`) должны быть доступны через `PATH`
- Если `pg_ctl` не найден, скрипт завершится с понятной ошибкой и просьбой добавить PostgreSQL tools в `PATH`

## Конфигурация
Файл `backend/.env.example` содержит полный список переменных. Ключевые:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `POSTGRES_SUPERUSER_PASSWORD` (нужен для `create_database.py`)
- `JWT_SECRET`, `JWT_EXPIRE_MINUTES`

Для seed можно переопределить:
- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD`

Переменные `LM_STUDIO_BASE_URL`, `LM_STUDIO_API_KEY` и `LM_MODEL` нужны только для `/api/v1/chat`; основной запуск backend/frontend от LM Studio не зависит.

## Рекомендуемые расширения VS Code
- `ms-python.python`
- `ms-python.vscode-pylance`
- `ms-python.debugpy`
- `mtxr.sqltools`
- `mtxr.sqltools-driver-pg`
- `eamodio.gitlens`
- `usernamehw.errorlens`
- `openai.chatgpt`

В репозитории также добавлены:
- `.vscode/tasks.json` для установки зависимостей, миграций, seed и запуска
- `.vscode/launch.json` для отладки backend через `uvicorn`

## API
- Базовый путь: `/api/v1/...`
- Swagger/OpenAPI: `http://localhost:8000/docs`
- Корень API: `GET /` -> `{ "status": "ok" }`

## Данные для входа (seed)
- Логин: `admin`
- Пароль: `admin12345`

## Versioning
- Каноническая версия проекта хранится в корневом файле `VERSION` в формате `vMAJOR.MINOR.BUILD`.
- `MAJOR` меняется только по явному решению для несовместимых или архитектурно крупных изменений.
- `MINOR` меняется только по явному решению для заметного функционального релиза.
- `BUILD` обязан повышаться при любой итерации изменений через Codex.
- Для обычного повышения версии используйте:
```powershell
python tools\bump_version.py
```
- Для ручного повышения старших частей используйте:
```powershell
python tools\bump_version.py minor
python tools\bump_version.py major
```
- После любых правок Codex должен указать в финальном сообщении новую версию проекта.

## Правило По Deploy Bundle
- Любые изменения проекта считаются незавершёнными, пока не актуализирован `deploy/dist/eqm-offline-bundle`.
- Это правило относится ко всем изменениям, которые влияют на backend, frontend, БД, Docker-образы, конфиги, runtime-пути, dump, справочники, enum-значения, инструкции по deploy или smoke-check.
- После любых таких правок нужно:
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1
```
- Если bundle уже существует, его нужно пересобрать заново, а не считать актуальным автоматически.
- Если менялись deploy-конфиги, документация или серверные скрипты, эти изменения должны попасть и в исходные файлы проекта, и в итоговый bundle.
- Для явной проверки свежести bundle используйте:
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\check-deploy-bundle-freshness.ps1
```
- Релизный чеклист лежит в `docs/deploy/06_bundle_release_checklist_ru.md`.

## Критерии готовности
- БД создается скриптом `create_database.py`
- Alembic применяет миграции без ошибок
- Seed выполняется без ошибок
- Backend доступен на `http://localhost:8000`
- Frontend доступен на `http://localhost:5173`

```
EQM
├─ AGENTS_CONTEXT.md
├─ Architecture.md
├─ backend
│  ├─ alembic
│  │  ├─ env.py
│  │  └─ versions
│  │     ├─ 0001_initial.py
│  │     ├─ 0002_align_architecture.py
│  │     └─ 0003_add_to_warehouse_movement.py
│  ├─ alembic.ini
│  ├─ app
│  │  ├─ core
│  │  │  ├─ audit.py
│  │  │  ├─ config.py
│  │  │  ├─ dependencies.py
│  │  │  ├─ pagination.py
│  │  │  ├─ query.py
│  │  │  └─ security.py
│  │  ├─ db
│  │  │  ├─ base.py
│  │  │  ├─ session.py
│  │  │  └─ __init__.py
│  │  ├─ main.py
│  │  ├─ models
│  │  │  ├─ attachments.py
│  │  │  ├─ audit.py
│  │  │  ├─ core.py
│  │  │  ├─ io.py
│  │  │  ├─ movements.py
│  │  │  ├─ operations.py
│  │  │  ├─ security.py
│  │  │  ├─ sessions.py
│  │  │  └─ __init__.py
│  │  ├─ routers
│  │  │  ├─ audit_logs.py
│  │  │  ├─ auth.py
│  │  │  ├─ cabinets.py
│  │  │  ├─ cabinet_items.py
│  │  │  ├─ dashboard.py
│  │  │  ├─ equipment_types.py
│  │  │  ├─ io_signals.py
│  │  │  ├─ locations.py
│  │  │  ├─ manufacturers.py
│  │  │  ├─ movements.py
│  │  │  ├─ sessions.py
│  │  │  ├─ users.py
│  │  │  ├─ warehouses.py
│  │  │  ├─ warehouse_items.py
│  │  │  └─ __init__.py
│  │  ├─ schemas
│  │  │  ├─ audit_logs.py
│  │  │  ├─ auth.py
│  │  │  ├─ cabinets.py
│  │  │  ├─ cabinet_items.py
│  │  │  ├─ common.py
│  │  │  ├─ dashboard.py
│  │  │  ├─ equipment_types.py
│  │  │  ├─ io_signals.py
│  │  │  ├─ locations.py
│  │  │  ├─ manufacturers.py
│  │  │  ├─ movements.py
│  │  │  ├─ sessions.py
│  │  │  ├─ users.py
│  │  │  ├─ warehouses.py
│  │  │  └─ warehouse_items.py
│  │  └─ __init__.py
│  ├─ requirements.txt
│  └─ scripts
│     ├─ create_database.py
│     └─ seed.py
├─ Checklist.md
├─ frontend
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ src
│  │  ├─ api
│  │  │  ├─ auth.ts
│  │  │  ├─ client.ts
│  │  │  └─ entities.ts
│  │  ├─ App.tsx
│  │  ├─ components
│  │  │  ├─ AppLayout.tsx
│  │  │  ├─ DataTable.tsx
│  │  │  ├─ DictionariesTabs.tsx
│  │  │  ├─ EntityDialog.tsx
│  │  │  └─ ErrorSnackbar.tsx
│  │  ├─ context
│  │  │  └─ AuthContext.tsx
│  │  ├─ main.tsx
│  │  ├─ pages
│  │  │  ├─ AuditLogsPage.tsx
│  │  │  ├─ CabinetItemsPage.tsx
│  │  │  ├─ CabinetsPage.tsx
│  │  │  ├─ DashboardPage.tsx
│  │  │  ├─ DictionariesPage.tsx
│  │  │  ├─ EquipmentTypesPage.tsx
│  │  │  ├─ IOSignalsPage.tsx
│  │  │  ├─ LocationsPage.tsx
│  │  │  ├─ LoginPage.tsx
│  │  │  ├─ ManufacturersPage.tsx
│  │  │  ├─ MovementsPage.tsx
│  │  │  ├─ SessionsPage.tsx
│  │  │  ├─ UsersPage.tsx
│  │  │  ├─ WarehouseItemsPage.tsx
│  │  │  └─ WarehousesPage.tsx
│  │  ├─ styles.css
│  │  ├─ utils
│  │  └─ vite-env.d.ts
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  ├─ tsconfig.node.tsbuildinfo
│  ├─ tsconfig.tsbuildinfo
│  ├─ vite.config.d.ts
│  ├─ vite.config.js
│  └─ vite.config.ts
├─ GitManual.md
├─ package-lock.json
├─ README.md
└─ START_PROMPT_FOR_CODEX v1.0.md

```

## Encoding
- Frontend source files should be UTF-8 (preferably without BOM).

```
EQM
├─ .editorconfig
├─ AGENTS_CONTEXT.md
├─ Architecture.md
├─ backend
│  ├─ alembic
│  │  ├─ env.py
│  │  └─ versions
│  │     ├─ 0001_initial.py
│  │     ├─ 0002_align_architecture.py
│  │     └─ 0003_add_to_warehouse_movement.py
│  ├─ alembic.ini
│  ├─ app
│  │  ├─ core
│  │  │  ├─ audit.py
│  │  │  ├─ config.py
│  │  │  ├─ dependencies.py
│  │  │  ├─ pagination.py
│  │  │  ├─ query.py
│  │  │  └─ security.py
│  │  ├─ db
│  │  │  ├─ base.py
│  │  │  ├─ session.py
│  │  │  └─ __init__.py
│  │  ├─ main.py
│  │  ├─ models
│  │  │  ├─ attachments.py
│  │  │  ├─ audit.py
│  │  │  ├─ core.py
│  │  │  ├─ io.py
│  │  │  ├─ movements.py
│  │  │  ├─ operations.py
│  │  │  ├─ security.py
│  │  │  ├─ sessions.py
│  │  │  └─ __init__.py
│  │  ├─ routers
│  │  │  ├─ audit_logs.py
│  │  │  ├─ auth.py
│  │  │  ├─ cabinets.py
│  │  │  ├─ cabinet_items.py
│  │  │  ├─ dashboard.py
│  │  │  ├─ equipment_types.py
│  │  │  ├─ io_signals.py
│  │  │  ├─ locations.py
│  │  │  ├─ manufacturers.py
│  │  │  ├─ movements.py
│  │  │  ├─ sessions.py
│  │  │  ├─ users.py
│  │  │  ├─ warehouses.py
│  │  │  ├─ warehouse_items.py
│  │  │  └─ __init__.py
│  │  ├─ schemas
│  │  │  ├─ audit_logs.py
│  │  │  ├─ auth.py
│  │  │  ├─ cabinets.py
│  │  │  ├─ cabinet_items.py
│  │  │  ├─ common.py
│  │  │  ├─ dashboard.py
│  │  │  ├─ equipment_types.py
│  │  │  ├─ io_signals.py
│  │  │  ├─ locations.py
│  │  │  ├─ manufacturers.py
│  │  │  ├─ movements.py
│  │  │  ├─ sessions.py
│  │  │  ├─ users.py
│  │  │  ├─ warehouses.py
│  │  │  └─ warehouse_items.py
│  │  └─ __init__.py
│  ├─ requirements.txt
│  └─ scripts
│     ├─ create_database.py
│     └─ seed.py
├─ Checklist.md
├─ frontend
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ README.md
│  ├─ src
│  │  ├─ api
│  │  │  ├─ auth.ts
│  │  │  ├─ client.ts
│  │  │  └─ entities.ts
│  │  ├─ App.tsx
│  │  ├─ components
│  │  │  ├─ AppLayout.tsx
│  │  │  ├─ DataTable.tsx
│  │  │  ├─ DictionariesTabs.tsx
│  │  │  ├─ EntityDialog.tsx
│  │  │  └─ ErrorSnackbar.tsx
│  │  ├─ context
│  │  │  ├─ AuthContext.tsx
│  │  │  └─ ThemeContext.tsx
│  │  ├─ i18n
│  │  │  ├─ index.ts
│  │  │  └─ locales
│  │  │     ├─ en.json
│  │  │     └─ ru.json
│  │  ├─ main.tsx
│  │  ├─ pages
│  │  │  ├─ AuditLogsPage.tsx
│  │  │  ├─ CabinetItemsPage.tsx
│  │  │  ├─ CabinetsPage.tsx
│  │  │  ├─ DashboardPage.tsx
│  │  │  ├─ DictionariesPage.tsx
│  │  │  ├─ EquipmentTypesPage.tsx
│  │  │  ├─ IOSignalsPage.tsx
│  │  │  ├─ LocationsPage.tsx
│  │  │  ├─ LoginPage.tsx
│  │  │  ├─ ManufacturersPage.tsx
│  │  │  ├─ MovementsPage.tsx
│  │  │  ├─ SessionsPage.tsx
│  │  │  ├─ UsersPage.tsx
│  │  │  ├─ WarehouseItemsPage.tsx
│  │  │  └─ WarehousesPage.tsx
│  │  ├─ styles.css
│  │  ├─ theme.ts
│  │  ├─ utils
│  │  └─ vite-env.d.ts
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  ├─ tsconfig.node.tsbuildinfo
│  ├─ tsconfig.tsbuildinfo
│  ├─ vite.config.d.ts
│  ├─ vite.config.js
│  └─ vite.config.ts
├─ GitManual.md
├─ package-lock.json
├─ README.md
└─ START_PROMPT_FOR_CODEX v1.0.md

```

Personnel module: staff profiles, competencies, and training records.
