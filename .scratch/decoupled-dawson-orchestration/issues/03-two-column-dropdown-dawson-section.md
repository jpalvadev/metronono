# 03: Two-Column Dropdown Dawson Section with Inline Staves & Actions

**What to build:**
A streamlined, visually balanced Alan Dawson Orchestration section replacing the legacy 5-card grid and inline buttons with a modern two-column layout. Drummers can select an ostinato and an interpretation system from two prominent dropdowns (including "Ninguno" for silence), visually inspect the 5-line drum stave for each layer, preview any pattern with an "Audition" button, and jump directly into editing via an "Editar" button.

**Blocked by:** 01 (Domain Model Decoupling, OstinatoPattern Entity & Engine Silence States), 02 (5-Line Drum Staff Stave Viewer for 4/4 Ostinatos and Silence States)

**Status:** ready-for-agent

- [ ] Header features "ALAN DAWSON ORCHESTRATION" with Tone.js badge and subtitle, and places the `Manage Systems, Formulas & Ostinatos` button on the top right.
- [ ] Body renders a two-column responsive grid (`grid-cols-1 lg:grid-cols-2`).
- [ ] Left column (Ostinato) provides:
  - Label and dropdown containing `"Ninguno"`, factory ostinatos (*Jazz Swing*, *Corcheas en Hi-Hat*), and any custom ostinatos.
  - 5-line drum staff displaying the active ostinato measure (or rests with "Silencio" badge if "Ninguno").
  - Action footer with `Audition` (plays the 4/4 ostinato loop once) and `Editar` button.
- [ ] Right column (Interpretation System) provides:
  - Label and dropdown containing `"Ninguno"`, factory systems (*Snare & Kick*, *Hi-Hat Foot & Kick*), and any custom systems.
  - Two stacked 5-line drum staves: Short Formula and Long Formula, each displaying pattern name, stroke count, `Audition` button, and `Editar` button.
  - If "Ninguno" is selected, both staves render rests with "Silencio" badges.
- [ ] Selecting an option in either dropdown updates `DawsonEngine` immediately without mutating the other dropdown's selection.
- [ ] Clicking "Editar" beneath any of the three staves opens the modal editor pre-loaded with that pattern.
- [ ] Component tests in `DawsonOrchestrationSection.test.tsx` verify dropdown interaction, stave updates, audition clicks, and edit modal triggering.
