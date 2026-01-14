# EQM — Context Bootstrap для Codex и Copilot + Руководство по безопасным изменениям

Дата: 2025-12-22  
Проект: **WEB приложение для учёта оборудования (EQM / CRM)**  
Стек: **FastAPI + SQLAlchemy + Alembic + PostgreSQL 16 + React (Vite) + TypeScript**

---

## 1) Зачем нужен этот файл

Этот документ предназначен для:
- **Codex** (агент, который генерирует/меняет код целыми пачками)
- **GitHub Copilot** (автодополнение и “микро-помощник” в файлах)
- **Тебя** (как владельца проекта)

Цель: чтобы любые изменения вносились **предсказуемо, безопасно и без поломок**, даже если у агента “заканчивается контекст”.

---

## 2) Context Bootstrap Prompt (вставлять агентам перед задачами)

### 2.1. Универсальный Bootstrap Prompt (Codex / Copilot Chat)

Скопируй и вставляй в начало каждой крупной сессии (особенно в новом окне контекста):

> Ты работаешь в репозитории **EQM** по пути `D:\Projects\WEB\EQM`.  
> Всегда сначала прочитай файлы в корне: `Architecture.md`, `README.md`, `Checklist.md`, а также этот файл `AGENTS_CONTEXT.md` (если он существует).  
> Стек: FastAPI + SQLAlchemy + Alembic + PostgreSQL 16, React/Vite + TypeScript.  
> Авторизация: простая **JWT** (логин выдаёт access_token).  
> Миграции Alembic: `0001_initial`, `0002_align_architecture` (JSONB + deleted_by_id FKs), `0003_add_to_warehouse_movement`.  
> **НЕЛЬЗЯ** редактировать уже применённые миграции ; любые изменения схемы — только новой миграцией `000x+`.  
> Реализовано: RBAC (viewer read-only, engineer write, admin users-management), soft-delete/restore, единые list params (`page`, `page_size`, `q`, `sort`, фильтры), audit_logs JSONB безопасно сериализуются.  
> Movements: `to_warehouse` (увеличивает склад), `to_cabinet` (со склада в шкаф), `direct_to_cabinet` (в шкаф без склада).  
> Любые изменения должны быть минимальными, дифф-ориентированными, не ломать работающие endpoints и UI.  
> В конце каждой задачи выведи: (1) список изменённых файлов, (2) команды проверки, (3) риски/миграции.

### 2.2. Правила для Copilot (как “инструкция в голове”)

Copilot не хранит контекст как Codex, поэтому для Copilot работает правило:
- **в начале файла** оставляй краткие комментарии “что это за модуль” и “какие ограничения”.
- **не принимать** предложения Copilot, если он предлагает:
  - менять структуру проекта целиком,
  - добавлять новые библиотеки без явной причины,
  - ломать типы DTO или уже используемые endpoints.

---

## 3) Общие “боевые” правила изменений

### 3.1. Всегда работай через Git checkpoint

Перед крупной задачей:
```powershell
git status
git add .
git commit -m "checkpoint: before <task>"
```

Если что-то сломалось:
```powershell
git reset --hard HEAD
```
или на заранее сохранённый тег:
```powershell
git tag checkpoint_x
git reset --hard checkpoint_x
```

### 3.2. Никаких правок в applied миграциях
- Любая новая таблица/колонка/индекс/constraint → **Alembic migration 000x+**.

### 3.3. Разделяй изменения
Делай изменения по слоям:
1) DB schema (Alembic)  
2) SQLAlchemy models  
3) Pydantic schemas (DTO)  
4) Routers/services (API)  
5) Frontend API client + types  
6) UI pages/components  
7) Dashboards/i18n/themes/import-export

Так меньше риск “цепной реакции”.

---

## 4) Как делать точечные изменения (безопасный шаблон)

Ниже — “рецепты” для типовых задач.

---

### 4.1. Добавить колонку в существующую таблицу (DB → API → UI)

**Шаги:**
1) **Alembic**: создать миграцию `000x_add_<field>.py`
2) Обновить SQLAlchemy model
3) Обновить Pydantic схемы: `Create/Update/Read`
4) Обновить роутер: разрешить фильтры/сортировку при необходимости
5) Обновить frontend DTO types + DataTable columns + формы

**Команды проверки:**
```powershell
cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

**DB проверка:**
```sql
\d+ table_name
```

---

### 4.2. Добавить новую таблицу + связи между таблицами

**Шаги:**
1) Alembic миграция `000x_create_<table>.py`:
   - create_table
   - foreign keys
   - indexes
2) SQLAlchemy model + relationship (back_populates)
3) Pydantic DTO: Create/Update/Read/List
4) CRUD Router + RBAC
5) Frontend: новая страница + добавить в меню, API клиент, формы

**Важно (стабильность):**
- FKs лучше делать `ON DELETE RESTRICT/SET NULL` (по смыслу), избегать каскадов без необходимости.
- Для soft-delete справочников — предусмотреть `is_deleted`, `deleted_at`, `deleted_by_id`.

---

### 4.3. Изменить бизнес-логику Movements (например новые типы движений)

**Шаги:**
1) Добавить enum/тип движения (если хранится в БД) → миграция.
2) Обновить сервис движения: правила остатков, запреты отрицательных остатков.
3) Обновить audit logging.
4) Добавить acceptance checks:
   - до/после количества на складе и в шкафу.

---

### 4.4. Добавить i18n RU/EN (переключение языка)

**Цель:** язык переключается “на лету”, выбор сохраняется.

**Шаги:**
1) Frontend: добавить `react-i18next` (или аналог) + файлы переводов `locales/ru.json`, `locales/en.json`
2) Обернуть приложение в `I18nextProvider`
3) Все строки вынести в `t("...")`
4) Добавить переключатель языка (Topbar)
5) Сохранение: localStorage (`lang=ru|en`)

**Проверки:**
- После переключения язык меняется сразу
- После F5 язык сохраняется

---

### 4.5. Добавить Light/Dark тему

**Шаги:**
1) MUI ThemeProvider: 2 темы (light/dark)
2) Toggle в Topbar
3) localStorage `theme=light|dark`

**Проверки:**
- UI меняет цвета сразу
- Сохраняется после перезагрузки

---

### 4.6. Импорт/экспорт Excel/CSV

**Рекомендуемый scope (безопасный):**
- Начать с **CSV export** (самое простое)
- Потом CSV import
- Потом Excel (XLSX)

**Архитектура:**
- Backend endpoint: `GET /<entity>/export?format=csv`
- Backend endpoint: `POST /<entity>/import` (multipart file)
- Frontend: кнопки Export/Import на странице таблицы

**Технические правила:**
- Экспорт: сервер формирует файл (чтобы сохранять фильтры/поиск)
- Импорт: сервер валидирует строки, возвращает отчёт (сколько добавлено/ошибок)
- Обязательно логировать audit

**Проверки:**
- Экспорт скачивается и открывается
- Импорт корректно создаёт записи и показывает ошибки по строкам

---

## 5) Шаблоны запросов к Codex (короткие и безопасные)

### 5.1. “Сделай только DB миграцию”
> Создай Alembic migration `000x_...` для: <описание>.  
> Не меняй applied миграции.  
> Обнови models только если нужно для autogenerate.  
> В конце дай команды проверки и SQL для проверки.

### 5.2. “Сделай только backend CRUD для сущности”
> Реализуй CRUD + soft-delete/restore для сущности <X> согласно Architecture.md.  
> Добавь Pydantic DTO, фильтры/поиск/сортировку, RBAC dependencies.  
> Не трогай frontend.  
> В конце перечисли endpoints и примеры curl.

### 5.3. “Сделай только frontend страницу под сущность”
> Добавь страницу React для сущности <X> с DataTable: search/filter/sort/pagination, create/edit/delete/restore.  
> Используй существующий API client и типы DTO.  
> Не меняй backend.  
> В конце: что проверить руками.

### 5.4. “Добавь новый блок UI (theme/i18n/import-export)”
> Добавь функциональность <описание> минимальными изменениями.  
> Не ломай текущие роуты и авторизацию.  
> Добавь переключатель в topbar.  
> Сохраняй настройки в localStorage.  
> Обязательно обнови README с короткой инструкцией.

---

## 6) Команды диагностики (когда “что-то сломалось”)

### Backend
```powershell
cd D:\Projects\WEB\EQM
.\.venv\Scripts\Activate.ps1
cd backend
alembic current
alembic history
alembic upgrade head
uvicorn app.main:app --reload
```

Проверить, какой python используется:
```powershell
where python
python -V
pip -V
```

### DB
Проверить доступность порта:
```powershell
netstat -ano | findstr :5432
```

Проверить соединение psql (если установлен psql):
```powershell
psql -h localhost -p 5432 -U equipment_user -d equipment_crm
```

### Frontend
```powershell
cd frontend
npm install
npm run dev
```

Если Vite падает на странных символах:
- искать по проекту: `` `r`n `` и `\n` (как текст в файлах)
- проверять кодировки JSON/INI: **UTF-8 без BOM**

---

## 7) Мини-правила по “чтобы ничего не упало”

1) **Одна задача — один слой** (или максимум два слоя)  
2) **Миграции только вперёд** (`000x+`)  
3) **После каждого шага**: `alembic upgrade head` + логин в `/docs`  
4) UI меняем после того, как API стабилен  
5) Любая бизнес-логика → покрыть smoke-тестами руками (через Swagger + SQL запросы)

---

## 8) Как понять, что проект соответствует Architecture.md (контрольные точки)

- CRUD реализован по всем таблицам/справочникам  
- Soft-delete/restore работает там, где требуется  
- Movements: to_warehouse / to_cabinet / direct_to_cabinet работают корректно  
- Audit_logs пишутся без ошибок и содержат meta  
- Overview dashboards показывают агрегаты  
- i18n RU/EN и theme toggle работают и сохраняются  
- Импорт/экспорт хотя бы CSV работает на ключевых таблицах

---

## 9) Последний коммит (автоматическая синхронизация)

Ниже — краткая автогенерируемая заметка о последнем коммите в репозитории, чтобы поддерживать актуальность контекста.

- **Commit:** 4622fccc526465bae4cb4d15f406b1ad4a0fb85e
- **Author:** hnd92brtsk-del
- **Date:** Wed Dec 24 16:24:57 2025 +0900
- **Subject:** Refactor translations and labels in various pages for better clarity and consistency
- **Body (summary):** Updated labels and error messages in several frontend pages for clearer Russian descriptions; improved sorting/search labels; added `.editorconfig` and initialized `package-lock.json`.
- **Files changed (name/status):**
   - A  .editorconfig
   - M  README.md
   - M  backend/app/core/config.py
   - M  backend/app/core/security.py
   - M  backend/requirements.txt
   - M  backend/scripts/seed.py
   - M  frontend/src/components/AppLayout.tsx
   - M  frontend/src/pages/CabinetItemsPage.tsx
   - M  frontend/src/pages/CabinetsPage.tsx
   - M  frontend/src/pages/IOSignalsPage.tsx
   - M  frontend/src/pages/MovementsPage.tsx
   - M  frontend/src/pages/WarehouseItemsPage.tsx
   - M  frontend/src/pages/WarehousesPage.tsx
   - A  package-lock.json

Команды быстрого просмотра/проверки изменений:

```powershell
cd D:\Projects\WEB\EQM
git show 4622fccc526465bae4cb4d15f406b1ad4a0fb85e --name-status
git --no-pager diff --staged --name-only
```

Риски / миграции:

- Из изменений видно только правки UI/текстов и конфигурации (`.editorconfig`, `package-lock.json`). Миграции БД не добавлялись — дополнительных Alembic миграций не требуется.
- Проверить, что изменения в `backend/app/core/security.py` и `backend/app/core/config.py` не нарушают RBAC/авторизацию (быстрая ручная проверка через `uvicorn` и Swagger рекомендована).

**Конец документа**
