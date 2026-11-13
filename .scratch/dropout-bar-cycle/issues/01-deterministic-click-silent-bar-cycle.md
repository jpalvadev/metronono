# 01: Deterministic Click/Silent Bar Cycle (Engine + UI Selectors)

**What to build:** When Dropout Mode is enabled, the user sees two compact numeric selectors (`Click Bars` and `Silent Bars`, range `0`–`32`, defaulting to `0`) positioned side by side above the `Silence Probability` slider. Whenever either count is greater than `0`, the Metronome repeats a deterministic cycle of `Click Bars` audible measures (honoring Beat Mask and Gap Clicks) followed by `Silent Bars` completely silent measures (muting all beats and Gap Clicks while Ostinato, Dawson System orchestration, and Playhead continue uninterrupted), bypassing stochastic probability. When both counts are `0`, Dropout Mode uses the existing stochastic `Silence Probability` behavior.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `DropoutConfig` includes `clickBars` and `silentBars` (defaulting to `0`), clamped to integers in `[0, 32]`.
- [x] `MetronomeEngine` evaluates the deterministic cycle whenever `clickBars > 0 || silentBars > 0` (including edge cases `clickBars > 0, silentBars === 0` always audible and `clickBars === 0, silentBars > 0` always silent), ignoring `probability`, and falls back to stochastic dropout when both are `0`.
- [x] `ToneTransportScheduler` gates both main beat clicks and Gap Clicks on the deterministic cycle while continuing to emit beat and dropout-change callbacks.
- [x] `Metronome` renders compact sharp-edged (`rounded-none`) numeric stepper/input controls for `Click Bars` and `Silent Bars` above the `Silence Probability` slider when Dropout Mode is enabled, wiring changes to the scheduler.
- [x] Domain, scheduler, and UI tests cover the deterministic cycle, clamping, fallback to `0 / 0`, and UI controls.
