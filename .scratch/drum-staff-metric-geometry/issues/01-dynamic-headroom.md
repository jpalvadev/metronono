# 01: Dynamic Headroom — margins earned from content, never clipping

**What to build:** The drum staff computes its vertical margins from what it draws: the highest and lowest drum-voice lines actually used (crash at line -1.0, hi-hat foot at 4.5) plus engraving clearances held as module-level named consts (stem reach, beam stack, tuplet bracket+number, accent, note half-height). staveY becomes the computed headroom; the SVG viewport height is max(requested, headroom + stave + footroom). A crash figure with a tuplet bracket renders fully inside the viewport; a plain quarter line keeps its compact height.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Engraving geometry exists as exported module-level consts (stem reach, beam stack, tuplet clearance, accent clearance) imported by the tests, not re-typed literals.
- [ ] A crash + triplet figure: staveY equals headroom computed from the consts, and the layout height exceeds the requested 140/160 viewport as the math dictates (grow, never clip).
- [ ] Every drawn notehead/stem/tuplet region sits inside the SVG viewport, asserted as geometry relationships from the consts (top of a crash stem with tuplet >= 0).
- [ ] A quarter-note-only line keeps the compact height (headroom only as big as that content needs, requested height still the floor).
- [ ] Existing renderer suite stays green (5-line stave, clef, voice1Notes-only, beams/tuplets unchanged).
