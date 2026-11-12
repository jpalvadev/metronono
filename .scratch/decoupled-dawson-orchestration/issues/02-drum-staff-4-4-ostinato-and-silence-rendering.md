# 02: 5-Line Drum Staff Stave Viewer for 4/4 Ostinatos and Silence States

**What to build:**
Enable drummers to see full 4/4 ostinato patterns engraved on standard 5-line percussion staves, showing polyphonic hand and foot cymbal/drum voices across the 4 beats. When either the ostinato or the interpretation system is set to "Ninguno", the stave cleanly displays a complete 4/4 measure of rests with a subtle "Silencio" state indicator, maintaining layout stability without empty collapses.

**Blocked by:** 01 (Domain Model Decoupling, OstinatoPattern Entity & Engine Silence States)

**Status:** resolved

- [x] `DrumStaffFormulaRenderer` supports rendering 4-beat patterns (`targetBeats: 4`, `timeSignature: [4, 4]`) across a 5-line stave with proper voice separation (voice 1 hands up-stem, voice 2 feet down-stem).
- [x] A dedicated read-only stave viewer component (or `PartitureFormulaCanvas` configured in read-only mode) accepts `OstinatoPattern.strokes` and renders the 4/4 measure with correct beams and rests.
- [x] When a pattern is empty or marked as silence ("Ninguno"), the stave renders a whole rest or full measure of rest figures accompanied by a subtle "Silencio" badge.
- [x] Stave rendering adapts responsively to container width without horizontal overflow or clipping.
- [x] Unit tests verify that a 4/4 ostinato with stacked unison hits (e.g. ride cymbal and hi-hat foot on beats 2 and 4) renders without VexFlow formatting errors.

## Answer

Implemented 4/4 drum staff stave viewer and silence rendering:
1. Updated `durationRatioToVexDuration` in `DrumStaffFormulaRenderer` to handle whole notes (`ratio >= 3.9 -> 'w'`) and half notes (`ratio >= 1.9 -> 'h'`), rendering whole rests cleanly in 4/4 measures.
2. Verified that 4/4 ostinatos with stacked unison hits (`jazz_swing` with ride and hi-hat foot on beats 2 and 4) render across 5-line percussion staves with Voice 1 up-stem and Voice 2 down-stem without VexFlow formatting issues.
3. Created `DrumStaffViewer` component (`src/components/dawson/DrumStaffViewer.tsx`) supporting responsive width resizing via `ResizeObserver`, whole-rest stave rendering, and subtle `"Silencio"` badge when silenced or empty. Complies strictly with token budget and one-style rules (`rounded-none`).
4. Unit tests in `DrumStaffFormulaRenderer.test.ts` and `DrumStaffViewer.test.tsx` pass cleanly.
