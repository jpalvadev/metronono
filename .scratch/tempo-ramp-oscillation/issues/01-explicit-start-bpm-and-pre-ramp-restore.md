# 01: Explicit Start BPM, Manual BPM Lock, and Pre-Ramp Restore

**What to build:** Add an explicit Start BPM input to the Tempo Ramp panel so users can configure both Start BPM and Target BPM independently (supporting both upward and downward ramps). Enabling Tempo Ramp preserves the Metronome's current BPM without overwriting Start BPM, locks all manual BPM controls while active, displays the instantaneous ramp BPM during playback, and restores the saved pre-ramp BPM when Tempo Ramp is turned off.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Tempo Ramp panel renders an editable numeric Start BPM input alongside Target BPM and Duration (bars), clamped to valid Metronome BPM bounds (30–300).
- [x] Ramps work bidirectionally (`Start < Target`, `Start > Target`, and `Start === Target`) with linear beat-level interpolation.
- [x] Enabling Tempo Ramp snapshots the current Metronome BPM as the pre-ramp tempo without overwriting the user's configured Start BPM.
- [x] While Tempo Ramp is enabled, all manual BPM controls (`-5`, `-1`, `+1`, `+5`, BPM slider, direct BPM input, and Tap Tempo) are disabled, and the main readout displays the instantaneous ramp BPM.
- [x] Disabling Tempo Ramp restores the saved pre-ramp BPM (both in the engine and on the active transport if playing) and re-enables all manual BPM controls.
- [x] Unit, scheduler, and component tests verify Start BPM editing, bidirectional ramping, manual BPM locking, and pre-ramp BPM restoration.
