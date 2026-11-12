# 03: Integrate & verify — mixed figures edit without collision, end to end

**What to build:** Prove the deepening through the component seams: a measure mixing swing triplets (1/3) and straight 16ths (0.25) is edited (click stamp + drag) without losing events, and the editor's committed strokes equal what the audio would schedule (same offsets). Screenshot the running app's partiture editor with the mixed figure for the visual gestalt (hover wash + hitboxes on rendered noteheads).

**Blocked by:** 01 (Canvas speaks continuous events), 02 (Editor slot bar becomes a quantized display strip).

**Status:** ready-for-agent

- [ ] New e2e-style suite: mixed 1/3 + 0.25 figure through the canvas — click at a triplet notehead stamps there, drag moves a voice to a 1/4 position, both ratios survive (stroke count and offsets asserted).
- [ ] App screenshot of the PartitureFormulaEditor with a jazz-swing + 16th mixed measure: no clipped notation (ADR-0012 headroom composes), overlay guides aligned with noteheads; committed to .scratch/ as evidence.
- [ ] Full npm run check green on the integration branch (style sweep, tsc, whole vitest suite).
