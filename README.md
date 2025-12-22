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
