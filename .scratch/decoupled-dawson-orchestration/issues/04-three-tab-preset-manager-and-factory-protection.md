# 04: Three-Tab Preset Manager with Ostinato CRUD and Factory Preset Protection

**What to build:**
A unified management modal (`PresetManager`) accessible from the header that organizes Alan Dawson assets into 3 dedicated tabs: Systems, Formulas, and Ostinatos. Drummers can create, edit, audition, duplicate, and delete custom ostinatos on a 4/4 5-line drum stave editor. Factory presets cannot be deleted; attempting to edit a factory preset saves as a new custom duplicate with `(Copia)` appended to protect the canonical patterns.

**Blocked by:** 01 (Domain Model Decoupling, OstinatoPattern Entity & Engine Silence States), 02 (5-Line Drum Staff Stave Viewer for 4/4 Ostinatos and Silence States), 03 (Two-Column Dropdown Dawson Section with Inline Staves & Actions)

**Status:** ready-for-agent

- [ ] `PresetManager` modal displays 3 tabs: **Sistemas**, **Fórmulas**, and **Ostinatos**.
- [ ] The "Ostinatos" tab lists all available ostinatos with badges distinguishing Factory from Custom presets.
- [ ] Each ostinato item provides an `Audition` button to preview sound and an `Editar` button to open the 4/4 stave editor.
- [ ] Custom ostinatos display an active `Eliminar` button; factory presets have deletion disabled.
- [ ] "Nuevo Ostinato" button initiates creating a fresh 4/4 pattern with default rests and opens the stave editor.
- [ ] `FormulaEditorDialog` supports editing both subdivision formulas and 4/4 ostinato patterns (accepting `targetBeats: 4`).
- [ ] When saving edits to a factory preset (system, formula, or ostinato), the dialog creates and saves a new custom entity with `(Copia)` appended to the name instead of overwriting the original.
- [ ] Component tests in `PresetManager.test.tsx` verify tab navigation, ostinato listing, creation, factory protection, and deletion.
