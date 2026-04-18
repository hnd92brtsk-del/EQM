# Developer Note: Nomenclature Selects

## Purpose
This note documents the required rule for any frontend dropdown, searchable select, dialog field, or filter that uses EQM nomenclature (`equipment_types`).

## Mandatory Rule
When a UI control must show nomenclature, it must load the full active list of `equipment_types` through pagination.

Do not load only the first page with code like:

```ts
listEntity("/equipment-types", { page: 1, page_size: 200 })
```

This is forbidden for nomenclature selectors because the list becomes incomplete as soon as the number of active positions exceeds the page size.

## Required Implementation
Use the shared helper:

```ts
listEquipmentTypesForSelect()
```

Location:

```text
frontend/src/api/equipmentTypes.ts
```

This helper:
- loads all active nomenclature entries page by page,
- keeps selector logic consistent across the application,
- prevents missing newly added nomenclature positions in UI dropdowns.

## Where This Rule Applies
Use the shared helper for:
- modal forms for adding or moving equipment,
- searchable dropdowns,
- filters by nomenclature,
- any other selector where the user expects the full current nomenclature.

This rule does not apply to paginated tables that intentionally show only one page at a time.

## Why This Is Important
EQM users expect the equipment list in operation, warehouse, movement, and digital twin forms to match nomenclature at any moment in time.

If a selector loads only one page:
- some nomenclature positions disappear from the UI,
- new records may not be selectable,
- operational workflows become inconsistent with the source dictionary.

## Current Reference Usage
At the time of writing, the shared helper is used on:
- `frontend/src/pages/CabinetItemsPage.tsx`
- `frontend/src/pages/WarehouseItemsPage.tsx`
- `frontend/src/pages/MovementsPage.tsx`
- `frontend/src/features/digitalTwin/DigitalTwinPage.tsx`

## Review Checklist
Before merging UI changes that introduce or modify a nomenclature selector, verify:
- the selector does not call `/equipment-types` with a single fixed first page,
- the selector uses `listEquipmentTypesForSelect()`,
- newly added nomenclature positions appear without being silently cut off by page size.
