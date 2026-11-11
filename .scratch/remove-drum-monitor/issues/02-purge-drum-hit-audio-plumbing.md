# 02: Purge Drum-Hit Event Plumbing from Audio Engine

**What to build:** The audio lookahead scheduler and drum kit player operate cleanly without dead pub/sub event machinery (`onDrumHit`, `drumHitListeners`, `hitListeners`, `notifyHit`) or main-thread synchronization loops for drum pads. Bar scheduling and voice triggering deliver samples with zero unused event dispatch overhead, and unit test suites reflect the streamlined interfaces.

**Blocked by:** 01 (Remove Real-Time Drum Monitor UI and Rename Section)

**Status:** ready-for-agent

- [ ] `onDrumHit`, `drumHitListeners`, and the drum-hit `drawSync` callback loop are removed from the audio scheduler.
- [ ] `onDrumHit`, `hitListeners`, and `notifyHit` are removed from the drum kit player.
- [ ] `onDrumHit` is removed from public scheduler and player interface contracts.
- [ ] Audio unit tests verify transport scheduling, voice playback, and channel audibility without registering or asserting on dead drum-hit listeners.
- [ ] Test mocks across the test suite are updated to remove unused `onDrumHit` stubs.
