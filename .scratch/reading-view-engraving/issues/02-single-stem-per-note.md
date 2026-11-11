# 02: Exactly one stem per note, always up

**What to build:** Beamed groups of Short Notes show a single clean stem per note — no doubled stem paths (the renderer currently draws each beamed note's stem twice, once from the note and once from the beam group, at slightly different tips). Stems always point up with tips a standard ~3.5 stave spaces above the notehead, beam bottoms resting exactly on the tips.

**Blocked by:** 01 (stems are pinned against the re-centered noteheads).

**Status:** resolved

- [x] No note in the rendered SVG has two stem paths at the same x
- [x] Every stem lies entirely above the stave line, tip at standard distance above the notehead center
- [x] Beam bottom y equals stem tip y for every beamed group
- [x] Existing stems-up guard test still passes with the tighter geometry

## Answer

Root cause of the doubling: `voice.draw` strokes each note's `Stem` element, and `Beam.draw()` re-strokes the *same* stems (`Beam.drawStems`) at beam-adjusted tips. Fix: keep `Beam.generateBeams(..., { stemDirection: Stem.UP })` to own the grouping/flag suppression, but never call `Beam.draw()`; a new `drawBeamRects` draws exactly one stem path per beamed note (voice skips stems of notes that carry a beam), then filled beam rectangles with the rect bottom resting exactly on the drawn stem tip (`BEAM_THICKNESS = 5`, tip = extents topY + `STEM_FLAG_INSET` 3; VexFlow's default stem is 35 px = 3.5 × 10 px spacing). Secondary beams for sixteenth pairs stack at `BEAM_STACK = 7.5` via `getBeamLines('8')`. Done in commit "fix(notation): one up-stem per beamed note with beam bottoms on the tips (ticket 02)".
