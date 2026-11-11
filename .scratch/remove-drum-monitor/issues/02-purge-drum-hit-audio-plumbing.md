# 02: Purge Drum-Hit Event Plumbing from Audio Engine

**What to build:** The audio lookahead scheduler and drum kit player operate cleanly without dead pub/sub event machinery (`onDrumHit`, `drumHitListeners`, `hitListeners`, `notifyHit`) or main-thread synchronization loops for drum pads. Bar scheduling and voice triggering deliver samples with zero unused event dispatch overhead, and unit test suites reflect the streamlined interfaces.

**Blocked by:** 01 (Remove Real-Time Drum Monitor UI and Rename Section)

**Status:** resolved

- [x] `onDrumHit`, `drumHitListeners`, and the drum-hit `drawSync` callback loop are removed from the audio scheduler.
- [x] `onDrumHit`, `hitListeners`, and `notifyHit` are removed from the drum kit player.
- [x] `onDrumHit` is removed from public scheduler and player interface contracts.
- [x] Audio unit tests verify transport scheduling, voice playback, and channel audibility without registering or asserting on dead drum-hit listeners.
- [x] Test mocks across the test suite are updated to remove unused `onDrumHit` stubs.

## Answer

`ToneTransportScheduler.ts`: the `drumHitListeners` registry, `onDrumHit()` subscription, its `dispose()` cleanup, and the gated `drawSync` drum-hit dispatch in `scheduleTicks` are gone (beat/dropout/play-state listeners and their `drawSync` remain). `DrumKitPlayer.ts`: `hitListeners`, `onDrumHit()`, `notifyHit()` and its calls in `play`/`triggerVoice` (plus the event object `triggerVoice` built only to announce hits) are gone, and `IDrumKitPlayer` no longer declares `onDrumHit`. Tests rewired to rig-trigger observations instead of listener capture: `ChannelAudibility.test.ts` "plays no stroke / plays again" via `rigTriggers`, `ChannelMembership.test.ts` names each stroke's channel through a capturing mock player, `DrumKitPlayer.test.ts` keeps rig-only assertions and its "Hit Listeners Subscription" block is retired, and every `onDrumHit: vi.fn()` mock stub across the component/audio suites is removed. Done in commit "chore(audio): purge drum-hit event plumbing from scheduler and player (ticket 02)".
