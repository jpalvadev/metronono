# 02: Eagerly-Built Audio Graph With a Single Master

**What to build:** The failure order that broke the mixer is reproduced in a test and fixed end-to-end. Construct an audio scheduler with nothing injected, read its mixer and drum-kit accessors the way the components do at mount — before any playback — and start the transport: the Click, Ostinato and Orchestration Mixing Channel gains all exist, each feeds one Master gain, the Master feeds the output, and the click plays through the Click channel rather than around it. Dragging any channel slider or toggling its mute drives that channel's real gain for the first time, and the built-in drum voices (kick, snare, ghost snare, toms, ride, hi-hat, crash) make sound instead of silently no-opping. There is exactly one Master: the second master-volume stage — its class, its interface, and the scheduler option that injected it — is deleted, and the scheduler's volume getters and setters delegate to the mixer's Master. The regression test is red when this ticket opens and green when it closes.

**Blocked by:** 01 (Recording Fake Tone Test Harness)

**Status:** ready-for-agent

- [ ] A wiring test drives the real production path — construct the scheduler with no injected mixer, drum kit, or volume control, touch the accessors, then start — and fails before the fix is made
- [ ] The whole graph is built once per scheduler instance, before any playback, behind a build-guard flag; initialization can no longer be skipped because "an instance already exists"
- [ ] The mixer's node initialization no longer accepts an external master node: it creates its own Master, and the three Mixing Channels connect to it
- [ ] The mixer and drum-kit accessors only ever return wired objects; they can no longer fabricate un-wired stand-ins
- [ ] The built-in drum synths are guaranteed constructed, so a built-in voice produces sound
- [ ] The master-volume class, its interface, and the scheduler's injection option for it are deleted; scheduler volume getters/setters delegate to the mixer's Master; the master's muted flag disappears from mixer state
- [ ] Volume-clamp coverage that existed for the deleted control is re-homed on the mixer (0.0 and 1.0 boundaries, ramped updates), not deleted
- [ ] The Metronome panel's existing master slider keeps working during this ticket by driving the single Master, until ticket 06 removes it
- [ ] The application shell disposes the audio scheduler on unmount, so a StrictMode double-render of the scheduler factory cannot leak a second graph
- [ ] All pre-existing suites still pass; any suite that asserted graph behavior by injecting fake mixer/player objects is updated to exercise the real build path with the fake Tone harness

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Implementation Decisions 1 and 2, Testing Decisions seam 1, regression guard). ADR-0005 is binding here, including the StrictMode and Android AudioContext-at-page-load consequences.
