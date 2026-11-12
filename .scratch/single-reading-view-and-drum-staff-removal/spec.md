# Single Reading View and Drum Staff Removal Spec

Status: resolved

## Problem Statement

The "Single-Line Reading Training" section currently features a view switcher allowing users to toggle between "Reading View" (a single-line rhythmic staff for sight-reading) and "Drum Staff (5 Lines)" (a 5-line percussion staff). In real-world Alan Dawson drum training, rhythmic reading practice operates strictly on the abstract single-line melody (Ted Reed style) where drummers perform mental orchestration over an ostinato; full-kit orchestration details belong to the Alan Dawson Orchestration engine and formula editor.

Having a 5-line drum staff toggle in the reading section creates visual clutter, introduces redundant UI controls, adds unnecessary view-state branching (`NotationViewMode`, `activeViewMode`, `viewMode`), and maintains approximately 1,000 lines of dead notation/editing code (`DrumStaffView.tsx`) that diverts from the core purpose of single-line reading. Furthermore, because Reading View is the sole intended mode, having a toggle button labeled "Reading View" is redundant UI noise.

## Solution

Retire the 5-line Drum Staff View from the reading training section entirely, consolidate Reading View as the sole and default notation view, and purge all obsolete view-mode branching and dead code:

1. In `ReadingTrainingSection`:
   - Remove the view switcher container and both buttons (`Reading View` and `Drum Staff (5 Lines)`).
   - Retain only the exercise mode switcher tabs (`Procedural Generator` and `Library`) on the right side of the section header.
   - Remove `activeViewMode` state, handlers, and view-switching conditional.
   - Render `<ReadingView readingLine={activeLine} scheduler={scheduler} />` directly and unconditionally.
2. In `App.tsx`:
   - Remove `viewMode` state and `setViewMode`.
   - Remove `NotationViewMode` import.
   - Remove `viewMode` and `onViewModeChange` props passed to `ReadingTrainingSection`.
3. In `src/components/notation/`:
   - Delete `DrumStaffView.tsx` and its test file `src/components/notation/__tests__/DrumStaffView.test.tsx`.
4. In `src/notation/`:
   - Remove the standalone `DrumStaffRenderer` class and its test file `src/notation/__tests__/DrumStaffRenderer.test.ts`.
   - Preserve `DRUM_VOICE_PAS_MAP`, `DrumVoicePAS`, and related types required by Dawson's formula editor (`PartitureFormulaCanvas`, `DrumStaffFormulaRenderer`).
5. In tests:
   - Update `src/__tests__/App.test.tsx` to assert that `ReadingView` is always present and that view toggles for "Drum Staff" and "Reading View" are absent from the DOM.
   - Ensure the full test suite passes cleanly.

## User Stories

1. As a drummer practicing sight reading, I want the Single-Line Reading Training section to display only the single-line rhythmic score, so that my focus remains entirely on mental interpretation and timekeeping without irrelevant view toggles.
2. As a drummer, I want no mode switcher buttons for "Reading View" or "Drum Staff (5 Lines)" in the reading header, so that the screen is free of meaningless single-option buttons.
3. As a drummer, I want the header to retain only the exercise source tabs ("Procedural Generator" and "Library"), so that I can easily switch exercises without visual distraction.
4. As a drummer, I want generated and library exercises to render directly in the clean single-line reading view, so that the reading experience is fast and consistent.
5. As a drummer composing orchestration formulas in the Alan Dawson section, I want the Partiture Formula editor to continue displaying drum voice positions accurately on its stave, so that formula editing functionality is unaffected by the removal of the reading section's 5-line staff.
6. As a developer maintaining the codebase, I want `DrumStaffView.tsx` and its test suite removed, so that there is no dead UI code or obsolete view abstractions.
7. As a developer maintaining the codebase, I want `viewMode` state eliminated from `App.tsx` and `ReadingTrainingSection`, so that component props and state hierarchies are simplified.
8. As a developer maintaining the codebase, I want the standalone `DrumStaffRenderer` class eliminated while keeping `DRUM_VOICE_PAS_MAP`, so that drum pitch positioning remains reusable without maintaining an unused score renderer.
9. As a developer running tests, I want `App.test.tsx` to assert the absence of the view toggle and the immediate availability of the reading view, so that regressions in UI layout are caught immediately.

## Implementation Decisions

- **UI Header Simplification (`ReadingTrainingSection`)**:
  - The header's right-hand container removes the view mode toggle group (`Reading View` and `Drum Staff (5 Lines)`).
  - The right-hand side now only contains the mode switcher tabs (`Procedural Generator` and `Library`).
  - The `activeViewMode` state and `handleViewModeChange` callback are deleted.
  - The score view area replaces the ternary `{activeViewMode === 'reading' ? <ReadingView ... /> : <DrumStaffView ... />}` with a direct `<ReadingView readingLine={activeLine} scheduler={scheduler} />`.

- **Shell State Cleanup (`App.tsx`)**:
  - The `viewMode` state variable, `setViewMode` setter, and `NotationViewMode` import are removed from `App.tsx`.
  - `ReadingTrainingSection` no longer accepts `viewMode` or `onViewModeChange` props.

- **Component & Renderer Deletion**:
  - `src/components/notation/DrumStaffView.tsx` is deleted.
  - `src/components/notation/__tests__/DrumStaffView.test.tsx` is deleted.
  - `src/notation/__tests__/DrumStaffRenderer.test.ts` is deleted.
  - In `src/notation/DrumStaffRenderer.ts`, the `DrumStaffRenderer` class, `DrumScoreMeasure`, `DrumMeasureCoordinate`, and `DrumScoreLayout` interfaces are removed.
  - `DRUM_VOICE_PAS_MAP` and `DrumVoicePAS` are retained in `src/notation/DrumStaffRenderer.ts` (or exported via a shared notation module) to satisfy dependencies in `PartitureFormulaCanvas`, `PartitureFormulaEditor`, and `DrumStaffFormulaRenderer`.

- **Architecture and Domain Alignment**:
  - ADR-0003 is superseded by ADR-0009.
  - `GLOSSARY.md` removes `Drum Staff View` and defines `Reading View` as the sole score view for reading training.

## Testing Decisions

- **Testing Principles**:
  - Tests verify external user-visible behavior and DOM structure at the highest practical seam.
  - No testing of internal component flags or private state.
- **Seams Tested**:
  - **`App.test.tsx`**: Assert that `ReadingTrainingSection` renders `ReadingView` unconditionally and that querying for buttons matching `/drum staff/i` or `/reading view/i` yields null.
  - **`PartitureFormulaCanvas` / `DrumStaffFormulaRenderer` tests**: Ensure Dawson formula stave rendering continues to pass using `DRUM_VOICE_PAS_MAP`.
  - **Full test suite (`npm run test`) and check (`npm run check`)**: Must pass with 0 errors.

## Out of Scope

- Modifying the Alan Dawson formula editor (`PartitureFormulaCanvas`, `PartitureFormulaEditor`, `DrumStaffFormulaRenderer`).
- Altering `ReadingView.ts` or `ReadingScoreRenderer.ts` engraving logic.
- Changing `Procedural Generator` or `Library` exercise generation and navigation logic.

## Further Notes

- This cleanup removes over 1,000 lines of dead code and eliminates dual-view state synchronization throughout the React hierarchy.
