# 08: Capture-scene regression — the whole Tier 1 page renders clean

**What to build:** The exact scene from the user's capture — a 16-bar Tier 1 procedural Reading Line at 4 measures per system — renders with every rule from tickets 01–07 satisfied at once: notes and rests on the line, single up-stems, no stranded flags, bracketing barlines, clear measure numbers, flush final pair. The user can point at the fixed capture and say "that's it".

**Blocked by:** 05, 06, 07 (which in turn gate on 01–04).

**Status:** resolved

- [x] A regression test renders the capture-shaped Reading Line (4×4 systems, mixed quarters/eighth pairs/lone eighths/rests) and asserts all geometry rules together against the SVG DOM
- [x] The whole-repo check (`tsc --noEmit` plus the full suite) passes on the integration branch
- [x] The throwaway geometry probe test file from the design session is deleted (it must not ship)

## Answer

`ReadingScoreRenderer.test.ts` now has a "renders the capture scene clean: 16 Tier-1 bars, 4 per system" test: alternating bars of [8 8 8 8 q 8 8] and [8 q 8 8 q 8r] at 4 measures per system, asserting on the SVG DOM — figures on the line (per system row), 96 unique stem paths with standard tips, 32 beam rects resting on tips, exactly 8 lone-eighth flags with none stranded beside a beam, 18 barlines bracketing each system's block, 4 measure numbers above the first-note column, and the flush final pair. A companion guard covers secondary beams over sixteenth pairs (code-review fix). `npm run check` (tsc + 370 tests) is green on feat/reading-view-engraving. The scratch probe `src/notation/__tests__/scratch-geometry.test.ts` was deleted before the first commit of the feature landed — it never shipped. Done in commits "test(notation): capture-scene regression for the full engraving rule set (ticket 08)" and "test(notation): secondary-beam stacking guard for sixteenth pairs (code review fix)".
