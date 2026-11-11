# 03: Flags only on lone short notes, never on beamed ones

**What to build:** A lone Short Note (an eighth or sixteenth not adjacent to another short note) keeps its flag so its duration reads correctly. Beamed Short Notes show only the beam — the renderer currently draws flags on beamed notes too, leaving flag glyphs stranded beside the beams in the capture.

**Blocked by:** 01 (flag geometry follows the re-centered notes); 02 (beaming/stem pass lands first).

**Status:** resolved

- [x] Rendered SVG: no flag paths on notes that belong to a beam group
- [x] Isolated eighth/sixteenth notes still render a flag
- [x] Run-of-two-and-more beaming behavior unchanged (pairs still beamed)

## Answer

`StaveNote.shouldDrawFlag()` returns false when `note.beam` is set, and `Beam`'s constructor calls `note.setBeam(this)`. Because ticket 02 moved `Beam.generateBeams` *before* `voice.draw`, beamed notes carry their beam at draw time and never render a flag; isolated short notes are in no beam group and keep their flag (drawn at the stem tip automatically). Guard test added in commit "test(notation): guard flags on lone short notes only, not beamed ones (ticket 03)".
