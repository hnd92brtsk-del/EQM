# EQM - Equipment Management Web Application

## Назначение проекта
EQM - web-приложение для учёта оборудования автоматизации, складов, шкафов автоматизации, I/O листов и связанных сущностей.  
Проект разворачивается локально (on-premise) и рассчитан на одновременную работу нескольких пользователей.

---

## Минимальные требования к окружению

- Windows 10 22H2
- PostgreSQL 16.3 (локально)
- Python 3.12.10
- Node.js 24.12.0
- npm 11.6.2

---

## Структура проекта

```
EQM/
├── Architecture.md          # Полное ТЗ и архитектура
├── Checklist.md             # Чеклист проверки и диагностики
├── START_PROMPT_FOR_CODEX v1.0.md
├── README.md                # (этот файл)
├── backend/                 # FastAPI + SQLAlchemy + Alembic
└── frontend/                # Vite + React + MUI
```

---

## Запуск (Windows PowerShell)

### 1) Создание venv
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2) Установка зависимостей
```powershell
pip install -r backend\requirements.txt
```

### 3) Создание БД
Скопируйте шаблон окружения и укажите пароли:
```powershell
Copy-Item backend\.env.example backend\.env
```

После этого выполните:
```powershell
python backend\scripts\create_database.py
```

### 4) Alembic
```powershell
cd backend
alembic upgrade head
cd ..
```

### 5) Seed
```powershell
python backend\scripts\seed.py
```

### 6) Запуск backend
```powershell
cd backend
uvicorn app.main:app --reload
```

Backend будет доступен: `http://localhost:8000`

### 7) Запуск frontend
Откройте новое окно PowerShell:
```powershell
cd frontend
npm install
npm run dev
```

Frontend будет доступен: `http://localhost:5173`

---

## Данные для входа (seed)

- Логин: `admin`
- Пароль: `admin12345`

---

## Критерий готовности

- БД создаётся автоматически
- Alembic создаёт все таблицы
- Seed выполняется без ошибок
- Backend доступен на `http://localhost:8000`
- Frontend доступен на `http://localhost:5173`
- Можно:
  - залогиниться admin/admin12345
  - открыть справочники
  - добавить оборудование в шкаф напрямую
  - добавить оборудование со склада (если есть остатки)

```
EQM
├─ Architecture.md
├─ backend
│  ├─ alembic
│  │  ├─ env.py
│  │  └─ versions
│  │     └─ 0001_initial.py
│  ├─ alembic.ini
│  ├─ app
│  │  ├─ core
│  │  │  ├─ audit.py
│  │  │  ├─ config.py
│  │  │  ├─ dependencies.py
│  │  │  ├─ pagination.py
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
│  ├─ package.json
│  ├─ src
│  │  ├─ api
│  │  │  ├─ auth.ts
│  │  │  ├─ client.ts
│  │  │  └─ entities.ts
│  │  ├─ App.tsx
│  │  ├─ components
│  │  │  ├─ AppLayout.tsx
│  │  │  └─ DataTable.tsx
│  │  ├─ context
│  │  │  └─ AuthContext.tsx
│  │  ├─ main.tsx
│  │  ├─ pages
│  │  │  ├─ AuditLogsPage.tsx
│  │  │  ├─ CabinetItemsPage.tsx
│  │  │  ├─ DashboardPage.tsx
│  │  │  ├─ DictionariesPage.tsx
│  │  │  ├─ LoginPage.tsx
│  │  │  ├─ MovementsPage.tsx
│  │  │  ├─ SessionsPage.tsx
│  │  │  └─ UsersPage.tsx
│  │  ├─ styles.css
│  │  ├─ utils
│  │  └─ vite-env.d.ts
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  └─ vite.config.ts
├─ GitManual.md
├─ README.md
└─ START_PROMPT_FOR_CODEX v1.0.md

```