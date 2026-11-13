Status: ready-for-agent

# Tempo Ramp: Start/Target BPM, Bidirectional Oscillation, and Pre-Ramp Restore

## Problem Statement

Today, the Metronome's Tempo Ramp panel only lets the user edit Target BPM and Duration (bars). When enabled, it silently overwrites Start BPM with the current Metronome tempo, can only stay at Target BPM after finishing, leaves manual BPM controls active (creating conflicts with the ramp), and leaves the Metronome stuck at the ramped tempo when turned off. Drummers practicing speed-building or deceleration exercises cannot configure an explicit starting tempo, practice back-and-forth speed pyramids, or return cleanly to their baseline tempo when turning the ramp off.

## Solution

Upgrade Tempo Ramp into a complete bidirectional speed-training mode:
1. Expose an explicit **Start BPM** input alongside **Target BPM** and **Duration (bars)**, supporting both accelerating (`Start < Target`) and decelerating (`Start > Target`) ramps.
2. Add an **Oscillate (Start ↔ Target)** checkbox (unchecked by default):
   - Unchecked: interpolates linearly from Start BPM to Target BPM over `Duration (bars)` and holds at Target BPM.
   - Checked: oscillates continuously back and forth between Start BPM and Target BPM using a symmetric triangle wave where `Duration (bars)` is the length of each leg.
3. Preserve the Metronome's active BPM when Tempo Ramp is enabled, lock all manual BPM controls while Tempo Ramp is active, display the instantaneous ramp BPM in the main readout, and restore the saved pre-ramp BPM when Tempo Ramp is disabled.
4. Reset the entire Metronome to measure 0, beat 0 whenever any ramp parameter is modified while Tempo Ramp is active, so the ramp restarts cleanly from Start BPM.
5. Display the current direction (`→` or `←`) and 0–100% position progress between Start BPM and Target BPM.

## User Stories

1. As a drummer, I want to set an explicit Start BPM in the Tempo Ramp panel, so that I can practice a ramp starting from a tempo different from my current Metronome BPM.
2. As a drummer, I want to set a Target BPM higher than Start BPM, so that I can practice gradual acceleration.
3. As a drummer, I want to set a Target BPM lower than Start BPM, so that I can practice gradual deceleration.
4. As a drummer, I want Start BPM and Target BPM to be clamped to the Metronome's valid BPM range (30–300), so that invalid tempos cannot be scheduled.
5. As a drummer, I want Tempo Ramp to hold at Target BPM by default (checkbox unchecked), so that existing ramp behavior remains familiar until I opt into oscillation.
6. As a drummer, I want to check an oscillation option to go back and forth between Start BPM and Target BPM, so that I can practice speed-up and slow-down cycles continuously.
7. As a drummer, I want Duration (bars) to define the length of each leg (`Start → Target` and `Target → Start`), so that enabling oscillation preserves the exact rate of tempo change per bar.
8. As a drummer, I want the oscillation curve to be a symmetric triangle wave without repeating peak or valley beats, so that the tempo turnarounds feel smooth and musical.
9. As a drummer, I want to see a direction arrow (`→` when moving toward Target BPM, `←` when returning toward Start BPM) and a 0–100% position indicator between Start and Target, so that I know where I am in the cycle at a glance.
10. As a drummer, I want the main BPM display to show the instantaneous ramp BPM while playing, so that I can see the exact tempo I am currently playing at.
11. As a drummer, I want manual BPM controls (`-5`, `-1`, `+1`, `+5`, BPM slider, direct BPM input, and Tap Tempo) to be locked while Tempo Ramp is enabled, so that I cannot accidentally fight the automated ramp.
12. As a drummer, I want the Metronome to remember the BPM I had before enabling Tempo Ramp and restore it when I turn Tempo Ramp off, so that I can return immediately to my baseline practice tempo.
13. As a drummer, I want editing Start BPM, Target BPM, Duration (bars), or the oscillation checkbox while Tempo Ramp is active to restart the entire Metronome from measure 0, beat 0 (starting at Start BPM), so that any change takes effect cleanly from the beginning of the exercise.
14. As a drummer, I want all time signatures and pulse feels (Straight and Triplet) to work seamlessly with bidirectional and oscillating ramps, so that beat-level interpolation matches the active meter.

## Implementation Decisions

- **Tempo Ramp Configuration Shape**: Extend the ramp configuration interface with an `oscillate: boolean` flag (default `false`). Keep `enabled`, `startBpm`, `targetBpm`, and `durationBars`.
- **Input Validation & Clamping**: Clamp `startBpm` and `targetBpm` to the Metronome engine's `MIN_BPM`..`MAX_BPM` bounds and `durationBars` to `1..64` (whole numbers).
- **Bidirectional & Triangle-Wave Interpolation**:
  - Let `totalBeats = durationBars * pulsesPerMeasure`.
  - When `oscillate` is `false`: `position = min(1, currentBeat / totalBeats)`, direction is `'forward'`, `isComplete` is `currentBeat >= totalBeats`.
  - When `oscillate` is `true`: fold `currentBeat` over `period = 2 * totalBeats` using `phase = currentBeat % period`. If `phase <= totalBeats`, `position = phase / totalBeats` and direction is `'forward'`; otherwise `position = (period - phase) / totalBeats` and direction is `'return'`. `isComplete` is `false` while oscillating.
  - Instantaneous BPM is `round(clamp(startBpm + (targetBpm - startBpm) * position))`.
- **Pre-Ramp BPM Snapshot & Restore**:
  - When `enabled` transitions from `false` to `true`, capture the engine's current `tempo` as `preRampTempo`, and do not overwrite `startBpm` with `tempo`.
  - When `enabled` transitions from `true` to `false`, restore `tempo` to the captured `preRampTempo` (if one was saved) and notify the transport if playing.
- **Full Metronome Reset on Ramp Parameter Change**:
  - When Tempo Ramp is enabled and any of `startBpm`, `targetBpm`, `durationBars`, or `oscillate` changes (or when Tempo Ramp transitions `false` to `true`), reset the Metronome engine's playback position (`reset()` to measure 0, beat 0).
  - At the transport scheduler boundary, when `setTempoRampConfig` is called while playing with Tempo Ramp enabled, update the transport BPM to the new starting tempo and clear any stale dropout UI state so the next scheduled beat starts cleanly at measure 0, beat 0.
- **UI Controls & Locking**:
  - In the Tempo Ramp panel, render numeric inputs for **Start BPM**, **Target BPM**, and **Duration (bars)**, plus a checkbox for **Oscillate (Start ↔ Target)**.
  - When Tempo Ramp is enabled, disable all manual BPM controls (`-5`, `-1`, `+1`, `+5` buttons, BPM slider, direct BPM number input, and Tap Tempo button).
  - When Tempo Ramp is disabled, re-enable all manual BPM controls and sync the displayed/input BPM to the restored pre-ramp tempo.
  - Render the progress summary with `Start → Target BPM` when holding or `Start ↔ Target BPM` when oscillating, along with the current direction arrow (`→` or `←`) and `Math.round(position * 100)%`.

## Testing Decisions

Good tests will verify external behavior only — observable BPM sequences per beat, UI control states, and transport scheduling — without inspecting private fields.

- **Domain Engine Seam** (Metronome engine unit tests, extending existing Tempo Ramp tests):
  - Bidirectional ramps (`startBpm < targetBpm` and `startBpm > targetBpm`, plus equal BPMs).
  - Hold-at-target (`oscillate: false`) vs symmetric triangle oscillation (`oscillate: true`) across multiple cycles, verifying no duplicate peak/valley beats and `durationBars` per leg.
  - Pre-ramp BPM snapshot on enable and exact restoration on disable (both mid-ramp and after completion).
  - Full engine reset to measure 0, beat 0 when changing `startBpm`, `targetBpm`, `durationBars`, or `oscillate` while enabled.
- **Transport Scheduler Seam** (scheduler integration tests):
  - Verify that updating ramp parameters while playing resets beat progression to measure 0, beat 0 at `startBpm` and that disabling ramp restores the pre-ramp BPM on the transport.
- **UI Component Seam** (`Metronome` component tests, extending existing component tests):
  - Verify Start BPM, Target BPM, Duration (bars), and Oscillate checkbox interactions.
  - Verify all manual BPM controls (`-5`, `-1`, `+1`, `+5`, slider, direct BPM input, Tap Tempo) are disabled when Tempo Ramp is ON and re-enabled with the restored pre-ramp BPM when turned OFF.
  - Verify progress summary displays the direction arrow and percentage.

## Out of Scope

- Automatically stopping the Metronome when a ramp completes.
- Sawtooth looping (jumping abruptly from Target BPM back to Start BPM).
- Persisting Tempo Ramp settings across page reloads.
- Non-linear (exponential/logarithmic) tempo curves.

## Further Notes

- Replaces and supersedes item 3 in `PENDING.md` (already removed as a duplicate of item 18).
- Canonical domain definition recorded under **Tempo Ramp** in `GLOSSARY.md`.
