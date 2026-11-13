# 03: Live Ramp Edit Full Metronome Reset

**What to build:** Editing any Tempo Ramp parameter (Start BPM, Target BPM, Duration (bars), or the oscillation checkbox) while Tempo Ramp is enabled resets the entire Metronome to measure 0, beat 0 so the ramp restarts cleanly from Start BPM at bar 0.

**Blocked by:** 02: Oscillate Mode (Start ↔ Target) and Direction Progress

**Status:** resolved

- [x] Changing `startBpm`, `targetBpm`, `durationBars`, or `oscillate` while Tempo Ramp is enabled resets the Metronome engine playback position to measure 0, beat 0 and sets the active tempo to `startBpm`.
- [x] Enabling Tempo Ramp (transitioning `false → true`) also resets the Metronome engine playback position to measure 0, beat 0.
- [x] When the transport scheduler is playing and Tempo Ramp parameters are updated while enabled, the transport BPM updates immediately to `startBpm` and any stale dropout indicator state is cleared so the next scheduled beat is measure 0, beat 0.
- [x] Engine, scheduler, and component tests verify that mid-playback edits to any ramp parameter restart the Metronome from measure 0, beat 0 at Start BPM.
