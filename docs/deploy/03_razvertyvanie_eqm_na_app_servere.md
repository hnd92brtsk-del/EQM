# Развёртывание EQM на `eqm-app-01`

## Целевая ОС

Используйте:

- **Ubuntu Server 24.04 LTS**
- hostname: `eqm-app-01`
- IP: `192.168.10.20`

## Что должно быть на сервере

Перед запуском подготовьте:

- установленную ОС;
- имя хоста `eqm-app-01`;
- статический IP `192.168.10.20`;
- скопированный каталог `offline-bundle`.

В примерах ниже считаем, что bundle лежит в:

```bash
/opt/eqm-install
```

## Шаг 1. Установка Docker Engine без интернета

Если Docker уже установлен, переходите к следующему шагу.

Если Docker устанавливается офлайн из заранее подготовленных `.deb`:

```bash
cd /opt/eqm-install/docker-debs
sudo apt install -y ./*.deb
```

Проверьте:

```bash
docker --version
docker compose version
```

Включите автозапуск:

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

## Шаг 2. Подготовка рабочих каталогов

Создайте каталог под развёртывание:

```bash
sudo mkdir -p /opt/eqm
sudo mkdir -p /srv/eqm-data/postgres
sudo mkdir -p /srv/eqm-data/photo
sudo mkdir -p /srv/eqm-data/datasheets
sudo mkdir -p /srv/eqm-data/uploads
sudo mkdir -p /srv/eqm-data/cabinet-files
sudo mkdir -p /srv/eqm-data/pid/diagrams
sudo mkdir -p /srv/eqm-data/pid/images
```

Выдайте права текущему администратору:

```bash
sudo chown -R $USER:$USER /opt/eqm
sudo chown -R $USER:$USER /srv/eqm-data
```

## Шаг 3. Копирование deployment-файлов

```bash
cp /opt/eqm-install/docker-compose.yml /opt/eqm/docker-compose.yml
cp /opt/eqm-install/.env.example /opt/eqm/.env
```

Откройте `.env`:

```bash
nano /opt/eqm/.env
```

Проверьте и при необходимости скорректируйте:

- `DB_PASSWORD`
- `POSTGRES_SUPERUSER_PASSWORD`
- `JWT_SECRET`
- `LLM_BASE_URL`
- `LLM_MODEL`

Для вашей схемы значения должны быть такими:

```env
LLM_BASE_URL=http://eqm-llm-01:1234/v1
LLM_MODEL=phi3-mini-4k-instruct
```

После первого запуска LM Studio обязательно замените `LLM_MODEL` на **точный id**, который вернёт:

```bash
curl http://eqm-llm-01:1234/v1/models
```

## Шаг 4. Загрузка Docker-образов

```bash
docker load -i /opt/eqm-install/images/eqm-backend_1.0.0.tar
docker load -i /opt/eqm-install/images/eqm-frontend-nginx_1.0.0.tar
docker load -i /opt/eqm-install/images/postgres_16.tar
```

Проверьте список:

```bash
docker images
```

## Шаг 5. Первый запуск контейнеров

```bash
cd /opt/eqm
docker compose up -d
```

Проверьте:

```bash
docker compose ps
docker compose logs postgres --tail=100
docker compose logs backend --tail=100
docker compose logs nginx --tail=100
```

## Шаг 6. Проверка доступности приложения

На самом сервере:

```bash
curl http://127.0.0.1/health
curl http://127.0.0.1/api/v1/dashboard/
```

С рабочего ПК в локальной сети:

```text
http://eqm-app-01/
http://eqm-app-01/api/v1
```

## Шаг 7. Повторный запуск после перезагрузки

Контейнеры будут подниматься автоматически из-за `restart: unless-stopped`.

Полезные команды:

```bash
cd /opt/eqm
docker compose ps
docker compose stop
docker compose start
docker compose restart
docker compose logs backend --tail=200
docker compose logs nginx --tail=200
docker compose logs postgres --tail=200
```

## Шаг 8. Обновление конфигурации

Если вы изменили `.env`, примените изменения так:

```bash
cd /opt/eqm
docker compose up -d
```

Если меняли только `LLM_MODEL`, обычно этого достаточно. Если меняли build-часть frontend, нужен пересобранный образ на ноутбуке и новый `docker load`.

## Что считается успешным результатом

Развёртывание считается успешным, если:

- открывается `http://eqm-app-01/`;
- backend отвечает по `http://eqm-app-01/api/v1`;
- логин работает;
- файлы сохраняются и не теряются после `docker compose restart`;
- контейнеры имеют статус `Up`.
