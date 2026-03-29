# Настройка LM Studio на `eqm-llm-01`

## Целевая ОС

Используйте:

- **Ubuntu Desktop 22.04.5 LTS**
- hostname: `eqm-llm-01`
- IP: `192.168.10.21`

## Почему именно Ubuntu Desktop

Для LM Studio в вашей задаче нужен GUI, потому что через него проще:

- проверить загрузку модели;
- увидеть, хватает ли RAM/VRAM;
- вручную выбрать `phi3-mini-4k-instruct`;
- включить сетевой API;
- быстро протестировать модель до подключения EQM.

## Что заранее перенести на сервер

На LLM-сервер нужно скопировать:

- `LM-Studio.AppImage`
- каталог с уже загруженной моделью `phi3-mini-4k-instruct`

Пример каталога:

```text
/opt/lmstudio/
├─ LM-Studio.AppImage
└─ models/
```

## Шаг 1. Подготовка AppImage

```bash
sudo mkdir -p /opt/lmstudio
sudo chown -R $USER:$USER /opt/lmstudio
cp ~/Downloads/LM-Studio.AppImage /opt/lmstudio/LM-Studio.AppImage
chmod +x /opt/lmstudio/LM-Studio.AppImage
```

## Шаг 2. Первый запуск

```bash
/opt/lmstudio/LM-Studio.AppImage
```

Если система спросит, доверять ли приложению, подтвердите запуск.

## Шаг 3. Импорт модели

Если модель уже переносилась заранее, импортируйте её в каталог, который использует LM Studio.

Точный путь зависит от выбранной директории внутри LM Studio, поэтому логика простая:

1. Откройте LM Studio.
2. Проверьте путь хранилища моделей в настройках.
3. Скопируйте туда каталог модели `phi3-mini-4k-instruct`.

Если модель ещё не импортирована, сделайте это вручную через интерфейс LM Studio из локально лежащих файлов.

## Шаг 4. Включение локального API-сервера

В интерфейсе LM Studio:

1. Откройте раздел локального сервера.
2. Включите API server.
3. Включите режим **Serve on Local Network**.
4. Убедитесь, что сервер слушает порт `1234`.

Итоговый адрес должен быть таким:

```text
http://eqm-llm-01:1234
```

OpenAI-compatible endpoint будет:

```text
http://eqm-llm-01:1234/v1
```

## Шаг 5. Выбор модели для API

В LM Studio выберите модель семейства:

```text
Phi-3 Mini 4K Instruct
```

Важно:

- в конфиге EQM нельзя полагаться только на красивое название;
- нужно узнать **точный model id**, который отдает сам API.

## Шаг 6. Проверка API с самого LLM-сервера

```bash
curl http://127.0.0.1:1234/v1/models
```

Вы получите JSON со списком моделей. Найдите точный `id`.

Пример логики:

- если в JSON пришёл `phi3-mini-4k-instruct`, используйте его;
- если пришёл другой точный id, например `microsoft/Phi-3-mini-4k-instruct-gguf`, используйте именно его.

## Шаг 7. Проверка с app-сервера

На `eqm-app-01` выполните:

```bash
curl http://eqm-llm-01:1234/v1/models
```

Если ответ есть, сетевой доступ между серверами настроен правильно.

## Шаг 8. Прописать `LLM_MODEL` в EQM

На `eqm-app-01` откройте:

```bash
nano /opt/eqm/.env
```

Укажите:

```env
LLM_BASE_URL=http://eqm-llm-01:1234/v1
LLM_MODEL=<точный_id_из_/v1/models>
```

Затем перезапустите backend:

```bash
cd /opt/eqm
docker compose restart backend
```

## Шаг 9. Проверка через тестовый запрос

Проверка напрямую в LM Studio:

```bash
curl http://127.0.0.1:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "phi3-mini-4k-instruct",
    "messages": [
      {"role": "user", "content": "Ответь одним словом: готово"}
    ]
  }'
```

Если `model` в ответе не совпадает, замените его на точный id из `/v1/models`.

## Запасной путь на будущее

Если позже GUI больше не понадобится, LLM-сервер можно перевести на headless-режим `llmster`. Но для первого внедрения это делать не нужно: LM Studio GUI проще и безопаснее для первичной настройки.
