# Frontend Notes

## i18n
- Файлы переводов: `src/i18n/locales/ru.json` и `src/i18n/locales/en.json`.
- Добавляйте новые ключи в оба файла и используйте `t("ключ")` через `useTranslation()` из `react-i18next`.
- Выбранный язык хранится в `localStorage` под ключом `eqm.lang`.
