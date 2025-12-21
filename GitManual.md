# GitManual — Git for Windows + GitHub SSH + ветки + VS Code  
Руководство для новичка (Windows) + адаптация под FastAPI/React/PostgreSQL стек

Дата: 20 декабря 2025

---

## 0) Установка Git for Windows — гайд для новичка (ВАЖНО)

Ниже — безопасные и рекомендуемые настройки. Если сомневаешься — выбирай именно так.

### Шаг 0. Скачать установщик
Официальный сайт:
- https://git-scm.com/install/windows  
(альтернативная официальная страница: https://gitforwindows.org)

Скачай **64-bit Git for Windows Setup** и запусти `.exe`.

### Шаг 1. Select Destination Location
✅ Ничего не меняй → **Next**

### Шаг 2. Select Components
✅ Оставь по умолчанию. Полезно, чтобы были отмечены:
- Git Bash Here
- Git GUI Here
- Git LFS (можно оставить)

### Шаг 3. Default editor used by Git
✅ Выбери: **Use Visual Studio Code as Git's default editor** → Next

### Шаг 4. Name of the initial branch
✅ Выбери **Override...** и укажи `main` → Next

### Шаг 5. PATH environment
✅ Выбери: **Git from the command line and also from 3rd-party software** → Next

### Шаг 6. SSH executable
✅ **Use bundled OpenSSH** → Next

### Шаг 7. HTTPS transport backend
✅ **Use the OpenSSL library** → Next

### Шаг 8. Line ending conversions
✅ **Checkout Windows-style, commit Unix-style line endings** → Next

### Шаг 9. Terminal emulator for Git Bash
✅ **Use MinTTY** → Next

### Шаг 10. `git pull` behavior
✅ **Default (fast-forward or merge)** → Next

### Шаг 11. Credential helper
✅ **Git Credential Manager** → Next

### Шаг 12. Extra options
✅ Оставь по умолчанию → Next

### Шаг 13. Experimental options
❌ Ничего не включай → **Install**

### Шаг 14. Проверка установки
Открой VS Code → Terminal и выполни:
```bash
git --version
```

---

## 1) GitHub SSH-ключи (рекомендуется)

SSH позволяет работать с GitHub без постоянного ввода логина/пароля в HTTPS.  
На Windows это обычно самое стабильное решение для разработчика.

### 1.1 Проверить, есть ли уже ключи
В терминале (Git Bash или PowerShell):
```bash
ls -al ~/.ssh
```
Если видишь файлы вроде `id_ed25519` и `id_ed25519.pub`, ключ уже может быть.

### 1.2 Создать новый SSH-ключ (Ed25519)
```bash
ssh-keygen -t ed25519 -C "you@example.com"
```
Подсказки:
- `Enter file in which to save the key` → нажми Enter (по умолчанию `~/.ssh/id_ed25519`)
- `Enter passphrase` → можно пусто, но лучше задать (безопаснее)

### 1.3 Запустить ssh-agent и добавить ключ
**Git Bash:**
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

**PowerShell (если потребуется):**
```powershell
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

### 1.4 Добавить SSH ключ в GitHub
Скопируй публичный ключ:
```bash
cat ~/.ssh/id_ed25519.pub
```
Скопируй весь вывод (начинается с `ssh-ed25519 ...`).

На GitHub:
- Settings → **SSH and GPG keys** → **New SSH key**
- Вставь ключ → Save

### 1.5 Проверить подключение
```bash
ssh -T git@github.com
```
Ожидаемо: сообщение приветствия (первый раз подтвердить fingerprint — `yes`).

### 1.6 Использовать SSH URL репозитория
SSH-адрес выглядит так:
```
git@github.com:<user>/<repo>.git
```

---

## 2) Мини-модель Git (как думать о нём)

Три зоны:
- **Working Directory** — файлы, которые ты редактируешь
- **Staging Area** — подготовка к коммиту
- **Repository (.git)** — история коммитов

Цикл:
изменил → `git add` → `git commit` → `git push`

---

## 3) Первый реальный workflow (feature-ветка → commit → push → merge)

Ниже — «рабочий стандарт» для одного разработчика и командной работы.

### 3.1 Старт: убедись, что `main` чистая
```bash
git status
git switch main
git pull
```

### 3.2 Создать feature-ветку
Пример: делаешь логин в бэкенде и фронтенде.
```bash
git switch -c feature/auth
```

### 3.3 Работать и коммитить небольшими шагами
1) Пишешь код  
2) Смотришь изменения:
```bash
git status
git diff
```
3) Добавляешь в staging:
```bash
git add .
```
4) Коммит:
```bash
git commit -m "Add auth endpoints and UI scaffold"
```

Рекомендация по коммитам:
- один коммит = один логический шаг
- сообщения в повелительном наклонении: `Add`, `Fix`, `Refactor`, `Update`

### 3.4 Отправить ветку на GitHub
(используя SSH URL репозитория)
```bash
git push -u origin feature/auth
```

### 3.5 Открыть Pull Request (PR) на GitHub
- GitHub предложит кнопку **Compare & pull request**.
- Создай PR: `feature/auth` → `main`.

Даже если ты один, PR полезен:
- видно историю и контекст
- проще проверять изменения перед merge

### 3.6 Обновить ветку перед merge (если нужно)
Если `main` менялась:
```bash
git switch main
git pull
git switch feature/auth
git merge main
```

### 3.7 Merge в main
Вариант 1: через GitHub (наиболее удобно новичку) — нажать **Merge**.

Вариант 2: локально:
```bash
git switch main
git merge feature/auth
git push
```

### 3.8 Удалить feature-ветку
После merge:
```bash
git branch -d feature/auth
git push origin --delete feature/auth
```

---

## 4) Git в VS Code (минимум, который реально нужен)

Открой **Source Control** (иконка веток слева).

Типовой сценарий:
1) Изменил файлы
2) Нажал **+** (Stage) у нужных файлов
3) Написал сообщение
4) **Commit**
5) **Push / Sync**

Полезные команды (Ctrl+Shift+P):
- `Git: Create Branch`
- `Git: Switch Branch`
- `Git: Pull`
- `Git: Push`

---

## 5) Адаптация под твой стек (FastAPI + SQLAlchemy + Alembic + PostgreSQL + React)

Твой стек:
- PostgreSQL 16.3
- FastAPI (Python 3.12.10)
- SQLAlchemy 2.x
- Alembic
- React (Node 24.12.0, npm 11.6.2)

### 5.1 Рекомендуемая структура репозитория (monorepo)
Один репозиторий, две директории:

```
repo/
  backend/
  frontend/
  README.md
  .gitignore
```

Почему это удобно:
- один PR включает и backend, и frontend изменения
- один issue/feature = одна ветка

### 5.2 .gitignore под твой стек (рекомендуемый минимум)

Создай/обнови `.gitignore` в корне репозитория:

```gitignore
# --- Python / FastAPI ---
__pycache__/
*.pyc
*.pyo
*.pyd
.pytest_cache/
.mypy_cache/
.ruff_cache/
.coverage
htmlcov/

# Virtual env
.venv/
venv/
ENV/
env/

# --- Alembic ---
# Обычно миграции КОММИТЯТСЯ:
# backend/alembic/versions/  (НЕ игнорировать)
# Игнорируй только временные/локальные файлы (если есть)

# --- Env / secrets ---
.env
.env.*
*.pem
*.key

# --- Node / React ---
node_modules/
dist/
build/
.vite/
.next/
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# --- OS / IDE ---
.DS_Store
Thumbs.db
.vscode/
.idea/

# --- Docker (если используешь) ---
*.log
```

Ключевое правило:
- **миграции Alembic (files в `alembic/versions`) обычно нужно коммитить**, иначе другие машины/сервер не смогут повторить схему БД.

### 5.3 Что коммитить/не коммитить в этом стеке

Коммитить:
- исходники (`backend/`, `frontend/`)
- `pyproject.toml` / `requirements.txt` (как у тебя устроено)
- `package.json`, `package-lock.json`/`pnpm-lock.yaml`
- alembic миграции (`backend/alembic/versions/...`)
- README, конфиги линтеров/форматтеров

Не коммитить:
- `.env` и любые секреты
- `.venv`, `node_modules`
- `dist/`, `build/` (если это артефакты сборки)

### 5.4 Практический workflow, где участвует Alembic
Типовой сценарий “изменил модель → миграция → коммит”:

1) Поменял модели SQLAlchemy  
2) Сгенерировал миграцию:
```bash
alembic revision --autogenerate -m "add users table"
```
3) Применил миграцию локально:
```bash
alembic upgrade head
```
4) Коммитишь **и код, и миграцию**:
```bash
git add .
git commit -m "Add users table (SQLAlchemy + Alembic migration)"
```

### 5.5 Рекомендуемые имена веток для твоего стека
- `feature/auth`
- `feature/users-crud`
- `feature/react-profile-page`
- `fix/login-redirect`
- `chore/deps-update`
- `refactor/db-session`

---

## 6) Быстрые команды-шпаргалка

```bash
# статус и история
git status
git log --oneline --decorate --graph --all

# базовый цикл
git add .
git commit -m "Message"
git push

# ветки
git switch -c feature/x
git switch main
git merge feature/x

# удалить ветку
git branch -d feature/x
git push origin --delete feature/x

# проверка SSH
ssh -T git@github.com
```

---

## 7) Частые ошибки (коротко)

### “Случайно добавил лишнее в staging”
```bash
git reset
```

### “Хочу вернуть файл как был”
```bash
git restore <file>
```

### “Хочу увидеть, что именно изменилось”
```bash
git diff
git diff --staged
```

---

Если хочешь — следующий практический шаг: я дам «сквозной сценарий» на твоём стеке (backend + frontend + Alembic), с примером ветки, коммитов и PR, как в реальной разработке.
