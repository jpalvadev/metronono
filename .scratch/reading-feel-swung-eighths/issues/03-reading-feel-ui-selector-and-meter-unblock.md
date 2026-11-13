# 03: Reading Feel UI Selector and 4/4 Meter Unblock

**What to build:** Add a `Feel: Straight | Swing` control to the `ReadingTrainingSection` top toolbar, synced with `scheduler.getReadingFeel()` and `scheduler.onReadingFeelChange()`. Unblock the 4/4 meter condition so reading lines and Dawson orchestration remain active in 4/4 regardless of swing selection. Pass `readingFeel` to `ReadingScoreRenderer` and persist the user's feel selection across the practice session.

**Blocked by:** 01: Swung Eighths Audio Timing and Measure Plan, 02: Reading Score Swing Indicator and Engraving Preservation

**Status:** completed

- [x] Add a `Feel` selector or toggle (`Straight` vs `Swing (♫ = ♩♪)`) in `ReadingTrainingSection.tsx` alongside Mode, Page, and Exercise selectors.
- [x] Update `isFourFour` in `ReadingTrainingSection` (and `DawsonOrchestrationSection`) so it depends only on `timeSignature.beats === 4 && timeSignature.beatUnit === 4`, removing any check that suspended 4/4 when reading feel is swing.
- [x] Pass the active `readingFeel` to `ReadingScoreRenderer` so the visual swing indicator renders.
- [x] Connect the UI control bidirectionally to `scheduler.getReadingFeel()` / `scheduler.setReadingFeel()` and listen for external changes.
- [x] Component tests in `ReadingTrainingSection.test.tsx` verify feel selection, scheduler calls, unsuspended 4/4 playback, and score re-rendering.
