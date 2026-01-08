# Frontend Notes

## i18n
- Р¤Р°Р№Р»С‹ РїРµСЂРµРІРѕРґРѕРІ: `src/i18n/locales/ru.json` Рё `src/i18n/locales/en.json`.
- Р”РѕР±Р°РІР»СЏР№С‚Рµ РЅРѕРІС‹Рµ РєР»СЋС‡Рё РІ РѕР±Р° С„Р°Р№Р»Р° Рё РёСЃРїРѕР»СЊР·СѓР№С‚Рµ `t("РєР»СЋС‡")` С‡РµСЂРµР· `useTranslation()` РёР· `react-i18next`.
- Р’С‹Р±СЂР°РЅРЅС‹Р№ СЏР·С‹Рє С…СЂР°РЅРёС‚СЃСЏ РІ `localStorage` РїРѕРґ РєР»СЋС‡РѕРј `eqm.lang`.

## Fonts and localization
- Use fonts with Cyrillic support and safe fallbacks (Manrope, Roboto, Noto Sans, Arial).
- If using Google Fonts, include the `subset=cyrillic` variant.
- Verify RU/EN strings render correctly after any style changes.
- Avoid placeholder strings like `???` in `src/i18n/locales/ru.json`.

## Локализация
- Добавляйте ключи в `src/i18n/locales/ru.json` и `src/i18n/locales/en.json`.
- Используйте `t("...")` в компонентах вместо хардкода.
- После изменений проверяйте отображение кириллицы (шрифты и кодировка).
