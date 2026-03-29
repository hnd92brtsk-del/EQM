# Help Guidelines

This document explains how to maintain the Help section in EQM.

## When to update Help
- If a menu item is added, renamed, removed, or moved in `frontend/src/navigation/nav.ts`, update the matching domain help module under `frontend/src/pages/help/`.
- If a page gets new controls, filters, tabs, destructive actions, document workflows, or changed operator behavior, update the corresponding screen guide inside the relevant help module.
- If `frontend/src/pages/AdminDiagnosticsPage.tsx` changes, review the long-form diagnostics instruction in `frontend/src/pages/help/AdminDiagnosticsHelpSection.tsx`.
- If `backend/app/services/diagnostics.py` changes error signatures, suggested commands, runtime topology fields, issue labels, or process-role logic, update the diagnostics help so the operator guide stays aligned with the real behavior.

## Content Model
- `frontend/src/pages/help/types.ts` remains the shared public structure:
  - `HelpSection` for a top-level domain section.
  - `HelpSearchEntry` for client-side full-text search.
  - `HelpAnchor` for subsection jump links.
- Domain help is now assembled from code modules under `frontend/src/pages/help/`, not from long i18n strings.
- Reuse `frontend/src/pages/help/builders.tsx` for common screen-guide layout and search-entry generation.
- Keep i18n JSON for short page labels and help-page chrome only. Do not move large operating manuals into locale JSON.

## Writing Rules
- Describe only behavior that exists in the code right now.
- If a screen is limited, partially implemented, or intentionally read-only, say so directly instead of implying future functionality.
- For each real screen, cover as many of these blocks as make sense:
  - what the screen is for;
  - when to use it;
  - how the screen is structured;
  - key actions;
  - a typical workflow;
  - risks and limitations;
  - related screens.
- Document destructive or sensitive actions explicitly: delete, restore, restart, import, export, bulk fill, permission changes, IP release/assignment, and similar operations.

## Search Rules
- Help search is client-side only; there is no backend endpoint or database index.
- Every top-level section must expose at least one `searchEntries` item.
- Every major screen guide should expose its own search entry with route, action names, and common terms.
- Search text should follow the current locale. Russian and English content may differ in depth, but each locale should remain internally coherent.
- Hidden workflow routes should still be discoverable through search even if they are not top-level menu items.

## Diagnostics Guide Rules
- The diagnostics guide is intentionally written for a junior administrator, not only for developers.
- Keep the guide synchronized with:
  - the three UI tabs (`Overview`, `Processes and ports`, `Errors and logs`);
  - runtime commands shown by diagnostics suggested command groups;
  - recognized error signatures and synthetic host events;
  - the current local Windows workflow plus Docker, Nginx, and Systemd operational checks.
- If a field appears in runtime topology, process tables, port tables, or log cards, either describe it in the guide or consciously decide that it is internal-only.
- If a destructive action exists, such as `Kill process` or log deletion, document both the purpose and the risk.

## Checkpoints
- Table-of-contents links must match top-level section IDs.
- Subsection links and search results must point to valid in-page anchors.
- `/help` must render after authentication for `viewer`, `engineer`, and `admin`.
- Test help search after major edits: search by page title, route, command, button name, error signature, and service name.
- Run a frontend build after significant help-page refactors to catch JSX and typing issues.
