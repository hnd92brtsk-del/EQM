# EQM Offline Deploy

Эта папка содержит всё, что нужно для подготовки полностью офлайн-поставки EQM.

Основной сценарий на исходной машине:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1
```

После выполнения появится bundle:

```text
deploy\dist\eqm-offline-bundle
```

Внутри него будут:

- готовые runtime Docker images в `deploy/runtime-images`
- deploy-конфиги в `deploy/app`
- свежий SQL dump и отчёты в `backup`
- постоянные файлы данных
- документация по развёртыванию и эксплуатации

Сервер без интернета должен разворачиваться именно из этого bundle, а не из git checkout.

## Обязательное Правило Актуализации Bundle

- Любая правка проекта должна рассматриваться как правка и самого deploy bundle.
- Нельзя считать задачу завершённой, если изменён проект, но не обновлён `deploy/dist/eqm-offline-bundle`.
- После изменений в коде, БД, Docker-конфигах, env, путях данных, dump, справочниках, enum-значениях или документации по deploy нужно заново выполнять:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1
```

- Если bundle уже был собран ранее, он всё равно должен быть пересобран после таких изменений.
- Перед передачей bundle нужно явно прогонять freshness-check:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\check-deploy-bundle-freshness.ps1
```

- Релизный чеклист: `docs/deploy/06_bundle_release_checklist_ru.md`
