# 04: Three-Tab Preset Manager with Ostinato CRUD and Factory Preset Protection

**What to build:**
A unified management modal (`PresetManager`) accessible from the header that organizes Alan Dawson assets into 3 dedicated tabs: Systems, Formulas, and Ostinatos. Drummers can create, edit, audition, duplicate, and delete custom ostinatos on a 4/4 5-line drum stave editor. Factory presets cannot be deleted; attempting to edit a factory preset saves as a new custom duplicate with `(Copia)` appended to protect the canonical patterns.

**Blocked by:** 01 (Domain Model Decoupling, OstinatoPattern Entity & Engine Silence States), 02 (5-Line Drum Staff Stave Viewer for 4/4 Ostinatos and Silence States), 03 (Two-Column Dropdown Dawson Section with Inline Staves & Actions)

**Status:** resolved

- [x] `PresetManager` modal displays 3 tabs: **Sistemas**, **Fórmulas**, and **Ostinatos**.
- [x] The "Ostinatos" tab lists all available ostinatos with badges distinguishing Factory from Custom presets.
- [x] Each ostinato item provides an `Audition` button to preview sound and an `Editar` button to open the 4/4 stave editor.
- [x] Custom ostinatos display an active `Eliminar` button; factory presets have deletion disabled.
- [x] "Nuevo Ostinato" button initiates creating a fresh 4/4 pattern with default rests and opens the stave editor.
- [x] `FormulaEditorDialog` supports editing both subdivision formulas and 4/4 ostinato patterns (accepting `targetBeats: 4`).
- [x] When saving edits to a factory preset (system, formula, or ostinato), the dialog creates and saves a new custom entity with `(Copia)` appended to the name instead of overwriting the original.
- [x] Component tests in `PresetManager.test.tsx` verify tab navigation, ostinato listing, creation, factory protection, and deletion.

## Answer

Implemented the consolidated 3-tab PresetManager modal with Ostinatos CRUD and factory preset immutability protection:
1. Updated `PresetManager` modal with 3 tabs: `Sistemas`, `Fórmulas`, and `Ostinatos`.
2. Built the Ostinatos tab listing factory and custom ostinatos with badges (`Fábrica / Built-in` vs `Custom`), Audition playback, Editar, and Eliminar (active only for custom presets, disabled for factory presets).
3. "Nuevo Ostinato" button creates a fresh 4/4 measure pattern and launches the stave editor.
4. Added factory preset protection in `FormulaEditorDialog` and `PresetManager`: saving any edits to a built-in preset clones the entity with `(Copia)` appended to the name under a new custom ID, preserving canonical factory presets.
5. All component tests in `PresetManager.test.tsx` pass.
