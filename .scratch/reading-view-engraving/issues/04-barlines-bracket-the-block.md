# 04: Barlines bracket the whole music block

**What to build:** Start and dividing barlines of the sight-reading score run the full height of the system's music block — from ~4 px above the highest beam/flag down to ~4 px below the notehead/rest bottoms — replacing the fixed ±14 px stubs that today look shorter than the notes they divide.

**Blocked by:** 02 and 03 (the block's top edge is defined by the final beam/flag geometry).

**Status:** resolved

- [x] Barline path endpoints are derived per system from beam/flag tops and notehead/rest bottoms with ≈4 px margins
- [x] Every dividing barline in a system spans at least the system's tallest figure (DOM assertion comparing barline endpoints to content extremes in the same system)
- [x] Barlines remain thin (1 px) and continuous across the stave line

## Answer

Barlines moved out of the per-measure loop into a new Pass 1.5: each system records its barline x positions (`SystemInfo` with `anyBeam`/`anyShort` flags). Extent: top = lineY − reach − `BARLINE_MARGIN` 4, where reach is `BEAM_REACH` 37 (beam top) / `STEM_REACH` 35 (flag tip) / `FIGURE_HALF_HEIGHT` 10; bottom = lineY + 10 + 4. `drawBarlineAt(x, topY, bottomY, lineWidth)` keeps 1 px thin strokes. Done in commit "fix(notation): barlines derive per-system extent bracketing the music block (ticket 04)".
