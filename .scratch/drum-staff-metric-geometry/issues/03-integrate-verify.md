# 03: Integrate & verify — the deepened layout holds end to end

**What to build:** The consumers exercised through their own seams prove the layout deepening end to end: a drum staff viewer with a jazz-swing ostinato (crash + ride strokes) shows the whole figure inside its grown viewport, and the partiture canvas playhead for a beat lands exactly on the notehead x that layout.strokeCoordinates carries — no drift, no clipping, no consumer change.

**Blocked by:** 01 (Dynamic Headroom), 02 (Note-Anchored Interpolation).

**Status:** ready-for-agent

- [ ] Viewer and canvas suites stay green with the grown height and anchor-based mapping (consumers untouched).
- [ ] A canvas-level assertion: getXForBeatOffset(offsetOfStroke(i)) equals strokeCoordinates[i].x for every stroke of a triplet figure (the regression net for the drift bug).
- [ ] Screenshot check of the DrumStaffViewer with a crash+triplet figure: no clipped glyphs (visual gestalt).
- [ ] Full npm run check green on the integration branch (style sweep, tsc, whole vitest suite).
