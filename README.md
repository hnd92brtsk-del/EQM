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
├─ frontend/                # Vite + React + MUI
├─ README.md                # Этот файл
└─ START_PROMPT_FOR_CODEX v1.0.md
```

## Быстрый старт (Windows PowerShell)

### 1) Виртуальное окружение
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

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
alembic upgrade head
cd ..
```

### 6) Seed-данные
```powershell
python backend\scripts\seed.py
```

### 7) Запуск backend
```powershell
cd backend
uvicorn app.main:app --reload
```
Backend будет доступен: `http://localhost:8000`

### 8) Запуск frontend
Откройте новое окно PowerShell:
```powershell
cd frontend
npm install
npm run dev
```
Frontend будет доступен: `http://localhost:5173`

## Конфигурация
Файл `backend/.env.example` содержит полный список переменных. Ключевые:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `POSTGRES_SUPERUSER_PASSWORD` (нужен для `create_database.py`)
- `JWT_SECRET`, `JWT_EXPIRE_MINUTES`

Для seed можно переопределить:
- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD`

## API
- Базовый путь: `/api/v1/...`
- Swagger/OpenAPI: `http://localhost:8000/docs`
- Корень API: `GET /` -> `{ "status": "ok" }`

## Данные для входа (seed)
- Логин: `admin`
- Пароль: `admin12345`

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
