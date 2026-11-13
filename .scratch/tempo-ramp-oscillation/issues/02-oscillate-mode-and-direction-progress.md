# 02: Oscillate Mode (Start ↔ Target) and Direction Progress

**What to build:** Add a checkbox in the Tempo Ramp panel (unchecked by default) to toggle between holding at Target BPM and oscillating continuously back and forth between Start BPM and Target BPM. When oscillating, the tempo follows a symmetric triangle wave where Duration (bars) defines the length of each leg without repeating peak or valley beats, and the progress readout displays the active direction arrow (`→` or `←`) and 0–100% position between Start and Target.

**Blocked by:** 01: Explicit Start BPM, Manual BPM Lock, and Pre-Ramp Restore

**Status:** resolved

- [x] Tempo Ramp configuration includes an `oscillate` boolean defaulting to `false`, exposed as an unchecked-by-default checkbox in the Tempo Ramp panel.
- [x] When `oscillate` is `false`, the ramp interpolates from Start BPM to Target BPM over `Duration (bars)` and holds at Target BPM.
- [x] When `oscillate` is `true`, the ramp oscillates continuously between Start BPM and Target BPM as a symmetric triangle wave where each leg (`Start → Target` and `Target → Start`) spans `Duration (bars)` with no duplicate peak or valley beats.
- [x] Progress reporting exposes the current direction (`forward` vs `return`) and position (`0..1` between Start BPM and Target BPM).
- [x] The Tempo Ramp progress readout displays `Start ↔ Target BPM` when oscillating, the direction arrow (`→` or `←`), and the 0–100% position percentage.
- [x] Unit and component tests verify hold-at-target default, multi-cycle symmetric triangle oscillation across time signatures and pulse feels, and direction/progress rendering.
