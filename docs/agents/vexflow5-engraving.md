# VexFlow 5 Engraving Gotchas

Behavior VexFlow 5 exhibits that the npm package does not confess (its bundle is minified; the `.d.ts` only shows signatures). Read this before changing any notation renderer — these facts were re-derived at high cost across the whole `reading-view-engraving` build.

## Figure anchors

- Notes, rests, clefs and time signatures are placed inside a **five-line box** even on one-line staves: key `b/4` resolves to the box's middle line, and `getYForNote` adds ~5× line spacing. A 1-line stave therefore makes figures hang ~20 px below the drawn line.
  - Cure: build a 5-line `Stave` with only `VISIBLE_LINE_INDEX = 2` drawn (the middle line, at `staveY + 3×spacing`, stroke at +0.5 for crisp pixels); keep keys `b/4` / `b/4/r`.
- `stave.getYForLine(i)` returns the drawn line's y on the phantom stave — use it, don't recompute.

## Spacing and stems

- Default line spacing is 10 px; VexFlow's **default stem is 35 px** (3.5 spaces). A manually drawn `Stem` at length 10 visibly disagrees with anything VexFlow strokes at 35 — barline spans must be sized from the system's actual reach, not a fixed stub.
- Manual up-stem: `stem.setNoteHeadXBounds(x, x)` then path from the glyph y up to y − length; `adjustHeightForFlag()` draws flagged paths 3 px short of the extents tip (`STEM_FLAG_INSET = 3`), which is what a beam resting on tips must match.

## Beam ↔ flag suppression

- `shouldDrawFlag()` returns false when `note.beam !== undefined`. `new Beam(...)` / `Beam.generateBeams(...)` call `setBeam`, so constructing the Beam **before `voice.draw`** suppresses flags — no `note.beam` post-surgery needed.
- But then `voice.draw` **skips the stems** of beamed notes, and `Beam.draw()` **re-strokes every beamed stem a second time** at slightly different endpoints (the doubled-stem artifact). Correct pattern: build the Beam for suppression + extents, never call `Beam.draw()`, and hand-draw one stem path per note plus beam rects resting exactly on the tips (`note.getStemExtents().topY + STEM_FLAG_INSET`).
- `beam.getBeamLines(...)` is keyed by **beam level** (`'4'` primary, `'8'` secondary), not by note duration; secondary beams stack by `beamWidth × 1.5` (`BEAM_STACK = 7.5`).
- `generateBeams(notes, { stemDirection: Stem.UP })` forces grouping direction; `voice.setStems` does not steer draw direction.

## Stave plumbing

- Built-in barlines span first-line-to-last-line, so on a 1-line stave they collapse to an invisible 1 px rect: use `tickSize(0)` and draw barlines explicitly.
- `stave.setMeasure(n)` pins the number to the stave's left edge (collides with the start barline, unreliable draw): hand-draw with `context.fillText` on the same renderer `StaveContext` instead.
- `modifier.setX(...)` before `stave.format()` gets overwritten by `format()`: call `stave.format()` first, then shift `getModifiers(StaveModifierPosition.BEGIN)` and `setNoteStartX`.

## For renderer tests

Keep engraving geometry (spacing, stem reach, beam thickness, clearances) as **module-level named consts** in the renderer so tests import them and assert coordinates against real numbers, not inline literals.
