# Checklist.md  
## Проверка и диагностика после генерации Codex

Документ предназначен для **новичка**. Используй его пошагово после того, как Codex сгенерировал проект.  
Все команды приведены для **Windows PowerShell**.

---

# ЧАСТЬ 1. Основной чеклист проверки (что нажать и что должно работать)

## 1. Проверка структуры проекта
В корне проекта должны быть:
- Architecture.md
- Checklist.md
- README.md
- папки backend/ и frontend/

В backend/ обязательно:
- app/main.py
- app/models/
- app/schemas/
- alembic/
- scripts/create_database.py
- scripts/seed.py
- .env.example

В frontend/:
- package.json
- src/
- .env.example

---

## 2. Создание базы данных PostgreSQL
```powershell
cd backend
python scripts\create_database.py
```
Ожидаемо: база и пользователь созданы или уже существуют.

---

## 3. Миграции Alembic
```powershell
alembic upgrade head
```
Проверь таблицы:
```powershell
psql -U equipment_user -d equipment_crm
```
```sql
\dt
```

---

## 4. Seed
```powershell
python scripts\seed.py
```
Ожидаемо: admin, Siemens, Склад 1, PLC-001.

---

## 5. Backend
```powershell
uvicorn app.main:app --reload --port 8000
```
Открой:
- http://localhost:8000/docs
- http://localhost:8000/api/v1/health

---

## 6. Frontend
```powershell
cd frontend
npm install
npm run dev
```
Открой http://localhost:5173

---

## 7. Авторизация
Войти: admin / admin12345

---

## 8. Движения и шкафы
- direct_to_cabinet — не трогает склад
- to_cabinet — уменьшает склад

---

# ЧАСТЬ 2. Если что-то сломалось

## Проверка портов
```powershell
netstat -ano | findstr :8000
netstat -ano | findstr :5173
```

## Проверка БД
```powershell
psql -U equipment_user -d equipment_crm
```

## Alembic
```powershell
alembic history
alembic current
```

## JWT
DevTools → Network → Authorization: Bearer ...

## CORS
Разрешить http://localhost:5173 в backend.

## Полный сброс (DEV)
```sql
DROP DATABASE equipment_crm;
```

---

Проект считается рабочим, если backend + frontend запускаются и шкафы наполняются двумя способами.
