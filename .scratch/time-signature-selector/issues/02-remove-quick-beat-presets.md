# 02: Remove Quick Beat Presets

**What to build:** Remove the `All`, `2 & 4 (Jazz)`, `1 & 3`, and `1 Only` quick-beat preset buttons and all mentions of them from the Metronome UI and tests, while preserving individual per-beat click-to-mute on the beat buttons.

**Blocked by:** 01: Arbitrary Time Signature Selector & Beat-Unit Timing

**Status:** resolved

- [x] `All`, `2 & 4 (Jazz)`, `1 & 3`, and `1 Only` buttons and their preset handler are removed from the Metronome UI
- [x] All mentions and tests referencing `All`, `2 & 4 (Jazz)`, `1 & 3`, and `1 Only` are removed
- [x] Individual per-beat click-to-mute on each beat button continues to work across any time signature
