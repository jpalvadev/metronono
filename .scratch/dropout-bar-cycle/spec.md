Status: ready-for-agent

## Problem Statement

Today, **Dropout Mode** in the **Metronome** only supports a single stochastic **Silence Probability** slider (`0%`–`100%`). Drummers practicing internal clock control often need a predictable, structured bar-based exercise — such as 3 bars with clicks followed by 1 bar of complete silence, or 4 bars on and 4 bars off — rather than purely random measure muting.

## Solution

Add two numeric selectors to **Dropout Mode**, positioned above the **Silence Probability** slider:
- **Click Bars** (`0`–`32`): number of consecutive measures where all Metronome pulses sound normally.
- **Silent Bars** (`0`–`32`): number of consecutive measures where all Metronome pulses (including **Gap Clicks**) are silenced.

The deterministic bar cycle and the stochastic **Silence Probability** randomizer are mutually exclusive:
- When both **Click Bars** and **Silent Bars** are `0`, **Dropout Mode** behaves as it does today using **Silence Probability**.
- When either **Click Bars** `> 0` or **Silent Bars** `> 0`, the **Silence Probability** slider is disabled and **Dropout Mode** repeats a deterministic cycle of `clickBars` audible measures followed by `silentBars` silent measures.

## User Stories

1. As a drummer practicing internal tempo, I want to set the number of measures with all tempo clicks (`Click Bars`, `0`–`32`) in Dropout Mode, so that I can establish the groove before the click drops out.
2. As a drummer practicing internal tempo, I want to set the number of measures with complete silence (`Silent Bars`, `0`–`32`) in Dropout Mode, so that I can test my internal clock over a fixed number of silent bars.
3. As a user, I want the **Click Bars** and **Silent Bars** selectors placed above the **Silence Probability** slider, so that structured bar-cycle controls are immediately accessible when enabling Dropout Mode.
4. As a user, I want to increment, decrement, or type a number between `0` and `32` in each bar-count selector using compact sharp-edged controls, so that I can quickly configure cycles like `3 / 1` or `4 / 4`.
5. As a user, I want the **Silence Probability** slider to be disabled (both visually and interactively) with a clear indicator whenever `Click Bars > 0` or `Silent Bars > 0`, so that I immediately understand the deterministic cycle overrides random dropout.
6. As a user, I want **Dropout Mode** to fall back to the **Silence Probability** randomizer when both **Click Bars** and **Silent Bars** are set back to `0`, so that the existing stochastic behavior remains available.
7. As a drummer using `Click Bars > 0` and `Silent Bars = 0`, I want every measure to sound normally with the randomizer disabled, so that I can temporarily hear all bars without losing my `Click Bars` setting.
8. As a drummer using `Click Bars = 0` and `Silent Bars > 0`, I want every measure to be silent with the randomizer disabled, so that I can practice completely without click while keeping Dropout Mode indicators active.
9. As a drummer, I want silent bars in the cycle to mute all Metronome beats and **Gap Clicks**, while audible bars respect my existing **Beat Mask** and **Gap Clicks** settings, so that my click configuration is preserved.
10. As a drummer practicing with **Reading Line**, **Ostinato**, or **Dawson System** orchestration, I want those layers and the **Playhead** to continue uninterrupted during silent Dropout bars, so that Dropout Mode only tests my internal clock against the Metronome click.
11. As a user, I want the bar cycle to restart from position `0` (beginning with the `Click Bars` phase) whenever I stop and restart the Metronome, so that every practice run starts predictably.
12. As a user, I want the bar cycle to restart from position `0` (anchored at the current measure without resetting the Metronome's global measure counter or **Tempo Ramp**) whenever I change `Click Bars` or `Silent Bars` while the clock is running, so that live adjustments take effect cleanly without disrupting Tempo Ramp progress.

## Implementation Decisions

- **Domain model (`DropoutConfig` & `MetronomeEngine`)**:
  - Extend `DropoutConfig` with `clickBars: number` and `silentBars: number`, defaulting both to `0`.
  - Clamp both values to integers in `[0, 32]` (non-finite inputs fall back to `0`).
  - Cycle evaluation in `shouldMuteMeasure(measureIndex, seed?)`:
    - If `!enabled` or `measureIndex < 0`: return `false`.
    - If `clickBars > 0 || silentBars > 0` (deterministic cycle active, stochastic randomizer bypassed):
      - Compute `cycleLength = clickBars + silentBars`.
      - Compute `cyclePosition = ((measureIndex - cycleAnchorMeasure) % cycleLength + cycleLength) % cycleLength`.
      - Return `cyclePosition >= clickBars` (so when `silentBars === 0`, always `false`; when `clickBars === 0`, always `true`).
    - Otherwise (`clickBars === 0 && silentBars === 0`): use the existing stochastic `probability` logic.
  - Cycle anchor tracking:
    - Track `dropoutCycleAnchorMeasure` initialized to `0`.
    - `reset()` resets `dropoutCycleAnchorMeasure` to `0` (and clears the stochastic `measureDropoutMap`).
    - When `setDropoutConfig` changes `clickBars` or `silentBars`, set `dropoutCycleAnchorMeasure = Math.max(0, currentMeasureIndex)` (and clear `measureDropoutMap` if returning to stochastic mode) so the new cycle starts at position `0` from the current measure without mutating `currentMeasureIndex` or breaking **Tempo Ramp**.
- **Scheduler & Audio**:
  - No changes needed to the audio graph or **Lookahead Scheduler**: `ToneTransportScheduler` already gates both main beat clicks and **Gap Clicks** on `beatEvent.isMuted` while letting **Ostinato**, **Dawson System** orchestration, and **Playhead** / visual callbacks continue.
- **UI (`Metronome` component & `Slider`)**:
  - Above the **Silence Probability** slider inside the **Dropout Mode** panel, render a two-column row with compact numeric stepper/input controls (`-`, numeric input `0`–`32`, `+`) for **Click Bars** and **Silent Bars**, styled with sharp `rounded-none` Lyra tokens.
  - When `clickBars > 0 || silentBars > 0`, disable the **Silence Probability** `Slider` (preventing pointer/keyboard changes and dimming it) and show a brief note indicating the randomizer is disabled while a bar cycle is active.
  - Ensure `Slider` supports a `disabled` prop cleanly (both visually and functionally).

## Testing Decisions

- **Good test principles**: Test observable external behavior through public module interfaces and rendered DOM interactions — do not assert private fields or internal helper calls.
- **Domain seam (`MetronomeEngine`)**:
  - Verify default `DropoutConfig` has `clickBars: 0`, `silentBars: 0`.
  - Verify clamping of out-of-range/non-integer values to `[0, 32]`.
  - Verify deterministic cycles (`3 / 1`, `2 / 2`, `3 / 0`, `0 / 2`) across multiple measures via `shouldMuteMeasure` and `nextBeat` (`isDropout`, `isMuted`), confirming `probability` is ignored whenever `clickBars > 0 || silentBars > 0`.
  - Verify `reset()` restarts the cycle at position `0`, and changing `clickBars` or `silentBars` mid-run restarts the cycle at position `0` from the current measure without resetting `BeatEvent.measureIndex` or **Tempo Ramp** progression.
  - Prior art: existing `Stochastic Dropout Mode` and `NextBeat Event Properties & Mute Gating` suites in `MetronomeEngine.test.ts`.
- **Scheduler seam (`ToneTransportScheduler`)**:
  - Verify a `clickBars: 1, silentBars: 1` cycle plays clicks on measure 0, silences both beat clicks and **Gap Clicks** on measure 1, and resumes clicks on measure 2 while emitting beat and dropout-change callbacks throughout.
  - Prior art: existing dropout gating test in `ToneTransportScheduler.test.ts`.
- **UI seam (`Metronome` component)**:
  - Verify rendering of **Click Bars** and **Silent Bars** numeric selectors above the **Silence Probability** slider when Dropout Mode is enabled.
  - Verify changing either selector calls `scheduler.setDropoutConfig` with clamped values and disables the **Silence Probability** slider; returning both to `0` re-enables the slider.
  - Prior art: existing `Dropout Mode & Visual Indicators` suite in `Metronome.test.tsx`.

## Out of Scope

- Persisting `DropoutConfig` across browser sessions in `StorageAdapter` (covered separately by session persistence work).
- Silencing **Ostinato** or **Dawson System** orchestration during Dropout bars.
- Per-beat patterns within a Dropout cycle (Dropout Mode operates at full-measure granularity).

## Further Notes

- Domain terminology is aligned with `GLOSSARY.md` (**Metronome**, **Dropout Mode**, **Gap Clicks**, **Ostinato**, **Dawson System**, **Playhead**).
