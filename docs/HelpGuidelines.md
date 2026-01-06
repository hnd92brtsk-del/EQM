# Help Guidelines

This document explains how to maintain the Help section in EQM.

## When to update Help
- If a menu item is added, renamed, removed, or moved in `frontend/src/navigation/nav.ts`,
  add or update the corresponding section in `frontend/src/pages/helpSections.tsx`.
- If UI actions change (for example, a new button like "Export" appears),
  update the relevant help section description.
- Keep the help content focused on UI actions, navigation, and page nesting.
  Avoid business logic details.

## Files to update
- `frontend/src/pages/helpSections.tsx`: Section titles and descriptions.
- `frontend/src/i18n/locales/en.json` and `frontend/src/i18n/locales/ru.json`: Labels such as `menu.help` and `pages.help`.
- `frontend/src/navigation/nav.ts`: The help entry (hidden from sidebar).

## Checkpoints
- Table of contents anchors must match section `id` values.
- Help must be accessible from any page via the AppBar button.
- Confirm that `/help` renders after authentication.
