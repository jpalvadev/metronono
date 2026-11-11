# 05: Measure number clear of the barline and beams

**What to build:** The measure number of each system sits above the first note of that system (right of the clef/time signature) and never superposes any barline — fixing the capture's "first barline stabs through the number 1". Numbers stay enabled; the header's `Bar: n / N` readout keeps matching them.

**Blocked by:** 01 (placement relative to the re-centered first note); 04 (number must clear the now full-height start barline).

**Status:** resolved

- [x] Measure-number text x/y clears the start barline's x-span and the top of the system's music block
- [x] One number per system, positioned above the first note's column
- [x] `ScoreLayout` measure coordinates still expose the system's left edge consistently

## Answer

`stave.setMeasure` pins the number at `stave.x − textWidth/2` (the system's left edge, colliding with the start barline at x=16). Replaced with an explicit `context.fillText(number, firstEventX, blockTopY − 4)` in Pass 1.5 — one per system, above the first note's column, above the block's top edge. `options.showMeasureNumbers` still honored; layout x values unchanged. Done in commit "fix(notation): measure numbers above first note column, clear of barlines (ticket 05)".
