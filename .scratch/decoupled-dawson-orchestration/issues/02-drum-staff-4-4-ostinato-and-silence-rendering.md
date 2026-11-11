# 02: 5-Line Drum Staff Stave Viewer for 4/4 Ostinatos and Silence States

**What to build:**
Enable drummers to see full 4/4 ostinato patterns engraved on standard 5-line percussion staves, showing polyphonic hand and foot cymbal/drum voices across the 4 beats. When either the ostinato or the interpretation system is set to "Ninguno", the stave cleanly displays a complete 4/4 measure of rests with a subtle "Silencio" state indicator, maintaining layout stability without empty collapses.

**Blocked by:** 01 (Domain Model Decoupling, OstinatoPattern Entity & Engine Silence States)

**Status:** ready-for-agent

- [ ] `DrumStaffFormulaRenderer` supports rendering 4-beat patterns (`targetBeats: 4`, `timeSignature: [4, 4]`) across a 5-line stave with proper voice separation (voice 1 hands up-stem, voice 2 feet down-stem).
- [ ] A dedicated read-only stave viewer component (or `PartitureFormulaCanvas` configured in read-only mode) accepts `OstinatoPattern.strokes` and renders the 4/4 measure with correct beams and rests.
- [ ] When a pattern is empty or marked as silence ("Ninguno"), the stave renders a whole rest or full measure of rest figures accompanied by a subtle "Silencio" badge.
- [ ] Stave rendering adapts responsively to container width without horizontal overflow or clipping.
- [ ] Unit tests verify that a 4/4 ostinato with stacked unison hits (e.g. ride cymbal and hi-hat foot on beats 2 and 4) renders without VexFlow formatting errors.
