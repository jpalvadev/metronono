# 01: Notes and rests centered on the stave line

**What to build:** In the sight-reading score (Reading View), every notehead and every rest of the Reading Line sits centered **on** the single stave line, instead of hanging ~20 px below it. The stave line passes through the middle of the figures. Ties (intra- and cross-measure) keep connecting the moved noteheads automatically.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Rendered SVG: notehead glyph centerlines align with the stave line y within tolerance (DOM geometry assertion, not counts)
- [x] Rest glyphs (eighth, quarter, half) likewise centered on the line
- [x] Existing stems-up guard and rest-layout tests stay green
- [x] `ScoreLayout` event-coordinate y values match what is drawn (coordinates follow the fix)

## Answer

Root cause: VexFlow anchors figures inside a phantom five-line box (key `b/4` resolves to its middle line), while the renderer drew a one-line stave whose line sits at the box *top* (`getYForLine(0)` = staveY + 4·spacing) — hence the ≈20 px hang. Fix: build the `Stave` with `numLines: 5` and `setConfigForLines` making only index `VISIBLE_LINE_INDEX = 2` visible, so the single drawn line passes through the middle of noteheads and rests (same key placement, both move together). `ScoreLayout` event y and barline anchors now use `getYForLine(2)`. Done in commit "fix(notation): center Reading View noteheads and rests on the stave line (ticket 01)" on branch feat/reading-view-engraving.
