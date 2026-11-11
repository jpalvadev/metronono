# 06: Clef, time signature, and first note clear the start barline

**What to build:** The thin start barline stays at the left of every system, but the percussion clef, time signature, and first note shift right by ~10–12 px so the system's left edge isn't crowded (the capture shows the clef only 5 px from the barline). Time signature only appears on the first system; clef repeats on each system.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Gap between the start barline x and the clef's left edge is ~10–12 px on every system
- [x] `noteStartX` in the layout contract reflects the shift (playhead anchors start after the cleared header)
- [x] Existing single-measure and multi-system layout tests stay green

## Answer

For the first measure of every system: `stave.format()` first, then every BEGIN modifier (clef/time signature) `setX(x + CLEF_CLEARANCE)` with `CLEF_CLEARANCE = 6` (VexFlow anchors the clef ≈5 px right of the stave x → measured gap ≈11 px), and `setNoteStartX` pushed by the same amount so the first note column — and `ScoreLayout.noteStartX`, hence playhead anchors — follow the header. Done in commit "fix(notation): shift clef/time signature/first note clear of the start barline (ticket 06)".
