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
