# 02: Exclusive Mode Slider Disable & Live Cycle Anchor Reset

**What to build:** Make the deterministic bar cycle and the stochastic `Silence Probability` randomizer visibly and interactively mutually exclusive in the UI, and ensure the bar cycle restarts cleanly from position `0` whenever the user stops/restarts the clock or edits `Click Bars` or `Silent Bars` while playing, without resetting the Metronome's global measure counter or breaking Tempo Ramp progression.

**Blocked by:** 01: Deterministic Click/Silent Bar Cycle (Engine + UI Selectors)

**Status:** resolved

- [x] `Slider` supports a `disabled` state that blocks pointer/keyboard interaction and dims the control.
- [x] In `Metronome`, whenever `clickBars > 0 || silentBars > 0`, the `Silence Probability` slider is disabled and accompanied by a brief note explaining that the bar cycle overrides random dropout; setting both back to `0` re-enables the slider.
- [x] Stopping and restarting the Metronome (`reset()`) restarts the dropout bar cycle from position `0` (beginning with the `Click Bars` phase).
- [x] Changing `clickBars` or `silentBars` while the Metronome is running restarts the dropout bar cycle from position `0` anchored at the current measure, without resetting `BeatEvent.measureIndex` or interrupting Tempo Ramp progression.
- [x] Domain and UI tests verify slider disable/re-enable behavior, `reset()` cycle restart, and live cycle-anchor reset alongside Tempo Ramp.
