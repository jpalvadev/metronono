# Decoupled Dawson Orchestration & First-Class Drum Staff Ostinatos Spec

Status: ready-for-agent

## Problem Statement

The Alan Dawson Orchestration section currently couples interpretation systems directly to ostinatos (e.g. selecting a system forcibly changes the ostinato), restricts ostinatos to hardcoded static strings without notation or customization, and presents systems as a rigid grid of 5 preset cards. This makes it impossible for drummers to freely combine any interpretation system with any ostinato (e.g. practicing Tony Williams triplets over straight 8ths, or bop orchestration over a custom rhythm), prevents practicing with either layer silenced independently, and lacks a visual 5-line drum staff for ostinatos.

Furthermore, managing systems, formulas, and ostinatos is fragmented: users cannot create, audition, edit, or delete ostinatos, nor can they directly edit formulas and ostinatos from the main view staves.

## Solution

Reimplement the Alan Dawson Orchestration section with a streamlined, visually clean two-column layout powered by completely decoupled domain models:

1. **Header**:
   - Title "ALAN DAWSON ORCHESTRATION" with Tone.js badge and subtitle.
   - On the top right: `Manage Systems, Formulas & Ostinatos` button opening a consolidated 3-tab preset manager modal.

2. **Left Column (Ostinato)**:
   - Dropdown with options: `"Ninguno"` (Silence / No Ostinato), factory presets (*"Jazz Swing"* and *"Corcheas en Hi-Hat"*), and user-created custom ostinatos.
   - Directly underneath: A standard 5-line drum staff displaying the 4/4 measure of the selected ostinato (or a measure of whole rests with a "Silencio" badge if "Ninguno" is selected).
   - Quick action controls: `Audition` (plays the 4/4 pattern once) and `Editar` (opens the modal drum staff editor configured for 4 beats).

3. **Right Column (Interpretation System)**:
   - Dropdown with options: `"Ninguno"` (Silence / No Orchestration), factory systems (*"Snare & Kick"* and *"Hi-Hat Foot & Kick"*), and user-created custom systems.
   - Directly underneath: Two 5-line drum staff viewers:
     - **Short Formula Staff**: Displays the short note formula on a 5-line staff, with formula name, stroke count, `Audition`, and `Editar` button.
     - **Long Formula Staff**: Displays the long note formula on a 5-line staff, with formula name, stroke count, `Audition`, and `Editar` button.
     - If `"Ninguno"` is selected, both staves display rest measures with a "Silencio" badge.

4. **Domain & Preset Model (`DawsonEngine` & `DawsonPresetManager`)**:
   - Promote Ostinatos to first-class domain entities (`OstinatoPattern`) containing a 4/4 measure of polyphonic `OrchestratedStroke[]`, with persistent CRUD in `DawsonPresetManager`.
   - Decouple `DawsonSystem` so it contains only `shortFormula` and `longFormula` (removing `ostinatoId`).
   - Factory presets are strictly 2 ostinatos and 2 systems:
     - Ostinatos: `jazz_swing` (Ride + Hi-hat foot on 2 and 4), `straight_8ths_hihat` (Hi-hat closed 8ths).
     - Systems: `snare_and_kick` (Short: snare, Long: kick), `hihat_foot_and_kick` (Short: hi-hat foot / pedal, Long: kick).
   - Factory presets are protected from deletion or overwrite; editing a factory preset saves as a new custom copy.

5. **Consolidated Manager Modal (`PresetManager`)**:
   - 3 tabs: **Sistemas**, **Fórmulas**, and **Ostinatos**.
   - The Ostinatos tab allows creating, auditioning, editing in 4/4 on the 5-line staff canvas, duplicating, and deleting custom ostinatos.

## User Stories

1. As a drummer practicing Alan Dawson orchestration, I want to select an Ostinato from a dedicated dropdown, so that I can practice over any background rhythm independently from my chosen interpretation system.
2. As a drummer, I want to select an Interpretation System from a dedicated dropdown, so that changing how short and long notes are voiced never overrides or changes my active ostinato.
3. As a drummer, I want to select "Ninguno" in the Ostinato dropdown, so that I can practice reading line orchestration without any background ostinato.
4. As a drummer, I want to select "Ninguno" in the Interpretation System dropdown, so that I can practice playing only the ostinato while viewing the reading line or practicing independence.
5. As a drummer, I want to see the active ostinato rendered on a standard 5-line drum staff directly below its dropdown, so that I can visually verify which limbs play which cymbal and pedal strokes across the 4 beats.
6. As a drummer, I want to see the Short Note Formula rendered on a 5-line drum staff below the system dropdown, so that I clearly see the stroke voicing and rhythm triggered by short notes.
7. As a drummer, I want to see the Long Note Formula rendered on a 5-line drum staff below the system dropdown, so that I clearly see the stroke voicing and rhythm triggered by long notes.
8. As a drummer, I want an "Audition" button under each of the three staves (Ostinato, Short Formula, Long Formula), so that I can preview that specific layer's sound on demand without starting the transport metronome.
9. As a drummer, I want an "Editar" button under each of the three staves, so that clicking it opens the 5-line drum staff editor directly focused on that specific pattern without having to search through tabs.
10. As a drummer, I want factory ostinatos to provide *"Jazz Swing"* (Ride with hi-hat foot on beats 2 and 4) and *"Corcheas en Hi-Hat"* (straight eighth notes on hi-hat), so that I have the essential foundational rhythms ready immediately.
11. As a drummer, I want factory systems to provide *"Snare & Kick"* (short: snare, long: kick) and *"Hi-Hat Foot & Kick"* (short: hi-hat pedal, long: kick), so that the classic Dawson syncopation exercises are available by default.
12. As a drummer, I want to open "Manage Systems, Formulas & Ostinatos" from the header, so that I can create, edit, delete, and duplicate custom ostinatos, formulas, and interpretation systems.
13. As a drummer, I want the Ostinato editor to support composing 4/4 measures with hands and feet on the 5-line staff, so that I can invent custom ostinatos (such as baiao, songo, or samba feet).
14. As a drummer, I want factory presets to be protected so that editing them automatically creates a customized user copy, ensuring the canonical patterns are never accidentally lost.
15. As a drummer, I want the section to display an elegant two-column layout on medium and large screens, so that all controls and staves fit harmoniously without clutter.

## Implementation Decisions

- **Domain Model Changes (`src/domain/dawson/types.ts`)**:
  - Introduce `OstinatoPattern`:
    ```ts
    export interface OstinatoPattern {
      id: string;
      name: string;
      description?: string;
      timeSignature: [number, number]; // [4, 4]
      strokes: OrchestratedStroke[];
      isCustom?: boolean;
    }
    ```
  - Refactor `DawsonSystem`:
    - Remove `ostinatoId: OstinatoType`.
    - Retain `id`, `name`, `shortFormula`, `longFormula`, `description`, `isCustom`.
  - Update `DawsonEngineOptions`:
    - Separate `activeOstinatoId: string | 'none'` and `activeSystemId: string | 'none'`.

- **Engine Orchestration (`src/domain/dawson/DawsonEngine.ts`)**:
  - `getOstinatoEvents()` resolves strokes from the active `OstinatoPattern` into measure events. When ostinato is `'none'`, returns `[]`.
  - `orchestrateReadingLine()` resolves strokes from `shortFormula` and `longFormula`. When system is `'none'`, returns `[]`.
  - Decouple `setSystem()` and `setOstinato()`: neither mutates the other.

- **Preset Storage (`src/domain/dawson/SubdivisionFormula.ts`)**:
  - Define built-in factory ostinatos: `FACTORY_OSTINATOS` with `jazz_swing` and `straight_8ths_hihat`.
  - Define built-in factory systems: `FACTORY_DAWSON_SYSTEMS` with `snare_and_kick` and `hihat_foot_and_kick`.
  - Define factory short formula `single_hihat_foot` (`hits: [{ voice: 'hihat_foot', dynamic: 'accent' }]`).
  - Extend `DawsonPresetManager`:
    - `getAllOstinatos(): OstinatoPattern[]`
    - `getOstinato(id: string): OstinatoPattern | undefined`
    - `saveOstinato(ostinato: OstinatoPattern): void`
    - `deleteOstinato(id: string): boolean`
    - Persistent storage key: `metronono_dawson_ostinatos`.

- **UI Component Refactor (`src/components/DawsonOrchestrationSection.tsx`)**:
  - Remove the old 5-card system grid and old inline ostinato button group.
  - Header: Section title with Tone.js badge on the left; button `<Button onClick={() => setIsPresetManagerOpen(true)}>Manage Systems, Formulas & Ostinatos</Button>` on the right.
  - Body: Two-column grid (`grid grid-cols-1 lg:grid-cols-2 gap-4`).
    - **Column 1 (Ostinato)**:
      - Label + Dropdown selector: Options: "Ninguno", Factory Ostinatos, Custom Ostinatos.
      - Staff Card: 5-line drum staff rendering the ostinato measure (`PartitureFormulaCanvas` in read-only mode, or `DrumStaffFormulaRenderer`). If "Ninguno", renders a measure of rests with a "Silencio" indicator.
      - Action footer: "Audition" button + "Editar" button.
    - **Column 2 (Interpretation System)**:
      - Label + Dropdown selector: Options: "Ninguno", Factory Systems, Custom Systems.
      - Two stacked cards:
        - Short Formula: Staff + Name + Stroke count + Audition + Editar.
        - Long Formula: Staff + Name + Stroke count + Audition + Editar.
        - If "Ninguno", both staves render rests with a "Silencio" indicator.

- **Preset Manager Modal (`src/components/dawson/PresetManager.tsx`)**:
  - Tab navigation: Systems (`Sistemas`), Formulas (`Fórmulas`), and Ostinatos (`Ostinatos`).
  - "Ostinatos" tab provides:
    - List of available ostinatos with badges (Built-in vs Custom).
    - Audition button for each.
    - Delete button (only enabled for custom ostinatos).
    - "New Ostinato" button that creates a 4/4 pattern and opens the editor.
    - "Editar" button opening the editor.

- **Formula & Ostinato Editor Dialog (`src/components/dawson/FormulaEditorDialog.tsx`)**:
  - Adaptable for 4/4 Ostinatos: accepts `targetBeats: 4` and labels appropriate for an ostinato measure.
  - Protects factory presets: if `formula.isCustom !== true`, saving saves as a cloned custom entity with `(Copia)` appended to the name.

## Testing Decisions

- **Testing Principles**:
  - Verify observable behavioral outcomes at the highest component seam (`DawsonOrchestrationSection.test.tsx`) and domain engine seam (`DawsonEngine.test.ts`, `SubdivisionFormula.test.ts`).
  - No assertion on internal private variables; assert through public APIs, rendered DOM elements, and emitted audio event schedules.
- **Seams Tested**:
  - **`DawsonEngine.test.ts`**:
    - Changing system does not alter ostinato.
    - Setting ostinato to `'none'` returns empty ostinato events.
    - Setting system to `'none'` returns empty orchestration events for reading line notes.
    - Ostinato pattern resolves into correct 4/4 drum voice events (ride + hi-hat foot for swing; closed hi-hat for 8ths).
    - System with `hihat_foot` short formula correctly triggers `hihat_foot` voice on short notes.
  - **`SubdivisionFormula.test.ts` / `DawsonPresetManager`**:
    - Ostinatos CRUD: save, retrieve, delete, and list custom ostinatos.
    - Factory ostinatos cannot be deleted.
    - Factory systems cannot be deleted.
  - **`DawsonOrchestrationSection.test.tsx`**:
    - Header contains "ALAN DAWSON ORCHESTRATION" and "Manage Systems, Formulas & Ostinatos" button.
    - Ostinato dropdown renders "Ninguno", factory ostinatos, and custom ostinatos.
    - System dropdown renders "Ninguno", factory systems, and custom systems.
    - Selecting an ostinato renders its 5-line staff and calls engine.
    - Selecting "Ninguno" shows the "Silencio" indicator.
    - Clicking "Editar" opens the editor modal for that pattern.
    - Audition buttons trigger kit player preview without throwing.
  - **`PresetManager.test.tsx`**:
    - Renders 3 tabs: Systems, Formulas, Ostinatos.
    - Ostinatos tab lists presets and allows creation and editing.
  - **Pre-commit verification**: Full `npm run check` and `npm run test` must pass with 0 errors.

## Out of Scope

- Time signatures other than 4/4 for ostinatos (Syncopation reading line is strictly 4/4).
- Midi export or external hardware drum triggering.
- Automatic polyrhythm generation.

## Further Notes

- Aligns with ADR-0010 and GLOSSARY.md updates.
- Maintains single light theme tokens (`bg-card`, `border-border`, `text-primary`, `bg-secondary`).
