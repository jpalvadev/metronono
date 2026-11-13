# 01: Arbitrary Time Signature Selector & Beat-Unit Timing

**What to build:** Allow the drummer to select any `N/D` time signature (numerator `1`–`32`, denominator `2`, `4`, `8`, `16`) such as `7/8`, `15/16`, `21/16`, `6/4`, `5/8`, `10/16`, and `5/4` in the Metronome, with beat buttons that wrap cleanly for large numerators and Gap Clicks that scale proportionally to the beat unit (quarter-note = BPM).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Metronome engine clamps/validates time signatures (`beats` in `1`–`32`, `beatUnit` in `{2, 4, 8, 16}`) and preserves existing beat mask entries when resizing
- [x] Metronome UI replaces the `4/4` and `3/4` toggle buttons with a paired Numerator (`1`–`32`) and Denominator (`2`, `4`, `8`, `16`) selector
- [x] Metronome beat buttons wrap (`flex-wrap`) and use compact sizing when `beats > 8` so `15/16` and `21/16` fit cleanly without horizontal overflow
- [x] Transport scheduler computes `beatDuration` as `(4 / beatUnit) * (60 / bpm)` so Gap Clicks subdivide the active beat unit accurately, and reschedules immediately when the time signature changes during playback
- [x] Engine, scheduler, and Metronome UI tests cover arbitrary `N/D` selection, beat-unit Gap Click timing, and beat wrapping
