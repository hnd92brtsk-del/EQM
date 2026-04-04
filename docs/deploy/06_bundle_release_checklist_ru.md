# EQM Bundle Release Checklist

## Назначение

Этот чеклист нужен для быстрой проверки, что `deploy/dist/eqm-offline-bundle` не устарел после правок проекта и готов к переносу на сервер.

## Обязательное правило

- Любая правка проекта должна считаться правкой и deploy bundle.
- Если изменились backend, frontend, БД, dump, Docker-образы, env, deploy-скрипты, docs/deploy, runtime-пути, справочники или enum-значения, bundle обязан быть пересобран.

## Быстрая проверка свежести

Из корня проекта:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\check-deploy-bundle-freshness.ps1
```

Ожидаемый результат:

- `BUNDLE FRESH`

Если скрипт показывает:

- `BUNDLE STALE`

нужно заново пересобрать bundle.

## Обязательные шаги перед передачей bundle

1. Проверить свежесть bundle:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\check-deploy-bundle-freshness.ps1
```

2. Если bundle устарел, пересобрать:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1
```

3. После пересборки снова проверить свежесть:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\check-deploy-bundle-freshness.ps1
```

4. Прогнать локальную smoke-проверку bundle:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\validate-offline-bundle.ps1 -BundleRoot .\deploy\dist\eqm-offline-bundle
```

5. Проверить, что в bundle присутствуют:

- `deploy/runtime-images/*.tar`
- `deploy/app/.env`
- `deploy/app/docker-compose.yml`
- `backup/equipment_crm_deploy.sql`
- `backup/equipment_crm_deploy_table_counts.tsv`
- `backup/equipment_crm_deploy_enums.txt`

6. Перед переносом на сервер убедиться, что bundle собран именно после последних правок проекта.

## Минимальный критерий готовности

Bundle считается готовым к передаче только если одновременно выполняются условия:

- freshness-check возвращает `BUNDLE FRESH`
- локальная smoke-проверка bundle проходит
- версия в `VERSION` совпадает с версией внутри bundle
- deploy-документация соответствует текущему runtime
