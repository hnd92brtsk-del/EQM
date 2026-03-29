# Имена, адреса и файл `hosts`

## Принятая схема адресов

Используйте такие имена и адреса:

| Роль | Имя | IP | Адрес |
|---|---|---|---|
| app-сервер | `eqm-app-01` | `192.168.10.20` | `http://eqm-app-01/` |
| frontend | `eqm-app-01` | `192.168.10.20` | `http://eqm-app-01/` |
| backend public | `eqm-app-01` | `192.168.10.20` | `http://eqm-app-01/api/v1` |
| backend internal | `backend` | docker-network | `http://backend:8000` |
| PostgreSQL internal | `postgres` | docker-network | `postgres:5432` |
| LLM-сервер | `eqm-llm-01` | `192.168.10.21` | `http://eqm-llm-01:1234/v1` |

## Что открывают пользователи

Пользователи работают только через:

```text
http://eqm-app-01/
```

или, если имя ещё не настроено:

```text
http://192.168.10.20/
```

## Что использует backend

Backend EQM внутри контейнера использует:

- БД: `postgres:5432`
- LLM: `http://eqm-llm-01:1234/v1`

То есть `localhost` для LLM использовать нельзя, потому что модель живёт на другом сервере.

## Когда нужен файл `hosts`

Если в локальной сети нет внутреннего DNS, нужно прописать имена вручную.

## `hosts` на Linux

Откройте:

```bash
sudo nano /etc/hosts
```

Добавьте:

```text
192.168.10.20 eqm-app-01
192.168.10.21 eqm-llm-01
```

Проверьте:

```bash
ping -c 2 eqm-app-01
ping -c 2 eqm-llm-01
```

## `hosts` на Windows

Откройте файл:

```text
C:\Windows\System32\drivers\etc\hosts
```

Добавьте:

```text
192.168.10.20 eqm-app-01
192.168.10.21 eqm-llm-01
```

Затем обновите DNS-кеш:

```powershell
ipconfig /flushdns
```

Проверьте:

```powershell
ping eqm-app-01
ping eqm-llm-01
```

## Что прописывать в конфиге EQM

В `/opt/eqm/.env` на app-сервере:

```env
CORS_ALLOW_ORIGINS=http://eqm-app-01,http://192.168.10.20
LLM_BASE_URL=http://eqm-llm-01:1234/v1
```

## Что считать правильной адресацией

Схема считается настроенной верно, если:

- пользователь открывает `http://eqm-app-01/`;
- backend доступен за тем же хостом через `/api/v1`;
- `eqm-app-01` видит `eqm-llm-01`;
- `curl http://eqm-llm-01:1234/v1/models` работает с app-сервера.
