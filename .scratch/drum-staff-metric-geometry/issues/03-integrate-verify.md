# 03: Integrate & verify — the deepened layout holds end to end

**What to build:** The consumers exercised through their own seams prove the layout deepening end to end: a drum staff viewer with a jazz-swing ostinato (crash + ride strokes) shows the whole figure inside its grown viewport, and the partiture canvas playhead for a beat lands exactly on the notehead x that layout.strokeCoordinates carries — no drift, no clipping, no consumer change.

**Blocked by:** 01 (Dynamic Headroom), 02 (Note-Anchored Interpolation).

**Status:** done

- [x] Viewer and canvas suites stay green with the grown height and anchor-based mapping (consumers untouched, except the crash-line pixel pin updated to the new margins).
- [x] A canvas-level assertion: the audition Playhead for a triplet offset lands on the rendered vf-stavenote glyph x (SVG ground truth, sub-pixel tolerance).
- [x] Screenshot check of the running app's Jazz Swing ostinato DrumStaffViewer (ride triplets + hi-hat foot): no clipped glyphs - tuplet brackets, stems and foot notes fully inside the grown viewport (.scratch/drum-staff-viewer-candidate2.png).
- [x] Full npm run check green on the integration branch (style sweep, tsc, whole vitest suite).
