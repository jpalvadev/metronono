# 01: Decouple notation constants and retire DrumStaffRenderer

**What to build:**
Preserve `DRUM_VOICE_PAS_MAP` and percussion stave positioning types in the notation module so that the Alan Dawson Partiture Formula editor and canvas continue to position drum voices accurately, while eliminating the unused standalone 5-line `DrumStaffRenderer` class, obsolete layout interfaces, and its retired test suite.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `DRUM_VOICE_PAS_MAP` and `DrumVoicePAS` are cleanly preserved and exported for use by Dawson formula components (`PartitureFormulaCanvas`, `PartitureFormulaEditor`, `DrumStaffFormulaRenderer`).
- [x] The standalone 5-line score rendering class `DrumStaffRenderer` is removed from `src/notation/DrumStaffRenderer.ts`.
- [x] Unused layout interfaces (`DrumScoreMeasure`, `DrumMeasureCoordinate`, `DrumScoreLayout`) specific to the retired 5-line staff renderer are removed.
- [x] The retired unit test file `src/notation/__tests__/DrumStaffRenderer.test.ts` is deleted.
- [x] Existing formula canvas and formula editor tests continue to pass without error.
