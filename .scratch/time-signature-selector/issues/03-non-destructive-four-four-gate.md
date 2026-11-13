# 03: Non-Destructive 4/4 Exercise Gate

**What to build:** Non-destructively suspend Ostinato, Dawson System orchestration, and Reading View playback/Playhead whenever the Metronome is set to any time signature other than `4/4`, showing a `"4/4 only"` indicator and automatically restoring the user's selections and playback when returning to `4/4`.

**Blocked by:** 01: Arbitrary Time Signature Selector & Beat-Unit Timing

**Status:** resolved

- [x] Transport scheduler exposes a time-signature change subscription and skips building/playing Measure Plan drum events (Ostinato and Dawson System orchestration) whenever the time signature is not `4/4`
- [x] Underlying Ostinato, Dawson System, and Reading Line selections are preserved (not reset to No Ostinato / No Orchestration) while in a non-`4/4` meter and resume automatically on return to `4/4`
- [x] Dawson Orchestration and Reading View subscribe to the scheduler's time signature, show a `"4/4 only"` suspended indicator when not in `4/4`, disable interactive exercise controls, and suppress the Reading View Playhead
- [x] Scheduler and UI tests verify audio suspension, Playhead suppression, `"4/4 only"` indicator, and non-destructive restoration on `4/4` ↔ non-`4/4` transitions
