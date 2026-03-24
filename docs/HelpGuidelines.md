# Help Guidelines

This document explains how to maintain the Help section in EQM.

## When to update Help
- If a menu item is added, renamed, removed, or moved in `frontend/src/navigation/nav.ts`, update the matching help section in `frontend/src/pages/helpSections.tsx`.
- If a page gets new controls, filters, tabs, destructive actions, or changed operator workflow, update the relevant help content.
- If `frontend/src/pages/AdminDiagnosticsPage.tsx` changes, review the long-form diagnostics instruction in `frontend/src/pages/help/AdminDiagnosticsHelpSection.tsx`.
- If `backend/app/services/diagnostics.py` changes error signatures, suggested commands, runtime topology fields, issue labels, or process-role logic, update the diagnostics help so the operator guide stays aligned with the real behavior.

## Content Model
- `frontend/src/pages/help/types.ts` defines the shared structure:
  - `HelpSection` for a top-level section.
  - `HelpSearchEntry` for client-side full-text search.
  - `HelpAnchor` for subsection jump links.
- Keep short help sections concise and store minimal searchable text in `searchEntries`.
- Keep long, structured operational guides in dedicated modules under `frontend/src/pages/help/` instead of placing hundreds of lines in i18n JSON.
- Use i18n JSON only for short UI labels such as page titles, search placeholders, and table-of-contents labels.

## Search Rules
- Help search is client-side only; there is no backend endpoint or database index.
- Every section must expose at least one `searchEntries` item so the page-wide search remains useful.
- Long-form guides should expose search entries for major subsections and for important troubleshooting cases.
- Search must work per current locale only. Keep Russian and English search text aligned conceptually, but do not mix languages in one search index.

## Diagnostics Guide Rules
- The diagnostics guide is intentionally written for a junior administrator, not only for developers.
- Keep the guide synchronized with:
  - the three UI tabs (`Overview`, `Processes and ports`, `Errors and logs`);
  - runtime commands shown by diagnostics suggested command groups;
  - recognized error signatures and synthetic host events;
  - the current local Windows workflow plus Docker/Nginx/Systemd operational checks.
- If a field appears in runtime topology, process tables, port tables, or log cards, either describe it in the guide or consciously decide that it is internal-only.
- If a destructive action exists, such as `Kill process` or log deletion, document both the purpose and the risk.

## Checkpoints
- Table-of-contents links must match top-level section IDs.
- Subsection links and search results must point to valid in-page anchors.
- `/help` must render after authentication for `viewer`, `engineer`, and `admin`.
- Test help search after major edits: search by page title, command, error signature, and service name.
- Run a frontend build after significant help-page refactors to catch JSX and typing issues.
