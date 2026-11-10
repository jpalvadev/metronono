# 02: Eagerly-Built Audio Graph With a Single Master

**What to build:** The failure order that broke the mixer is reproduced in a test and fixed end-to-end. Construct an audio scheduler with nothing injected, read its mixer and drum-kit accessors the way the components do at mount — before any playback — and start the transport: the Click, Ostinato and Orchestration Mixing Channel gains all exist, each feeds one Master gain, the Master feeds the output, and the click plays through the Click channel rather than around it. Dragging any channel slider or toggling its mute drives that channel's real gain for the first time, and the built-in drum voices (kick, snare, ghost snare, toms, ride, hi-hat, crash) make sound instead of silently no-opping. There is exactly one Master: the second master-volume stage — its class, its interface, and the scheduler option that injected it — is deleted, and the scheduler's volume getters and setters delegate to the mixer's Master. The regression test is red when this ticket opens and green when this ticket closes.

**Blocked by:** 01 (Recording Fake Tone Test Harness)

**Status:** resolved

- [x] A wiring test drives the real production path — construct the scheduler with no injected mixer, drum kit, or volume control, touch the accessors, then start — and fails before the fix is made
- [x] The whole graph is built once per scheduler instance, before any playback, behind a build-guard flag; initialization can no longer be skipped because "an instance already exists"
- [x] The mixer's node initialization no longer accepts an external master node: it creates its own Master, and the three Mixing Channels connect to it
- [x] The mixer and drum-kit accessors only ever return wired objects; they can no longer fabricate un-wired stand-ins
- [x] The built-in drum synths are guaranteed constructed, so a built-in voice produces sound
- [x] The master-volume class, its interface, and the scheduler's injection option for it are deleted; scheduler volume getters/setters delegate to the mixer's Master; the master's muted flag disappears from mixer state
- [x] Volume-clamp coverage that existed for the deleted control is re-homed on the mixer (0.0 and 1.0 boundaries, ramped updates), not deleted
- [x] The Metronome panel's existing master slider keeps working during this ticket by driving the single Master, until ticket 06 removes it
- [x] The application shell disposes the audio scheduler on unmount, so a StrictMode double-render of the scheduler factory cannot leak a second graph
- [x] All pre-existing suites still pass; any suite that asserted graph behavior by injecting fake mixer/player objects is updated to exercise the real build path with the fake Tone harness

## Answer

- `src/audio/__tests__/AudioGraphWiring.test.ts` is the regression suite on the production path: `new ToneTransportScheduler()`
  with nothing injected, `getAudioMixer()` / `getDrumKitPlayer()` read before any playback, then `start()`. It asserts the
  whole graph is already recorded — `mixer:master`, `mixer:click|ostinato|orchestration`,
  `audition:click|ostinato|orchestration` — that exactly one node is connected to the destination (the Master), that the
  built-in click voices and a composed drum hit reach the destination only through their Mixing Channel, that a second
  `start()` builds nothing new, that a Mixer handed to the scheduler is used rather than duplicated, and that `dispose()`
  leaves the destination with nothing connected. Against the old scheduler this suite is red: no channel nodes, no Master,
  no drum rigs.
- `AudioMixer.initToneNodes()` (`src/audio/AudioMixer.ts`) takes no master node: it builds its own `mixer:master`, connects
  it to the destination, then per Mixing Channel a main node (volume and mute, i.e. `getEffectiveVolume`) and an Audition
  node (the line volume, never silenced), both feeding that Master. Guarded by `masterNode`, so it is idempotent, and
  wrapped in a try/catch that tears a half-built graph back down and returns false, so an audio context that is not ready
  yet can simply retry.
- `ToneTransportScheduler` calls `buildAudioGraph()` from its constructor, `getAudioMixer()`, `getDrumKitPlayer()` and
  `ensureInitialized()`, and reports the result through `isAudioGraphReady()`. `getChannelNode()`, `getAuditionNode()` and
  `getMasterNode()` throw instead of returning undefined, and `getChannelNodes()` is deleted from `src/audio/types.ts`, so
  no caller can fabricate a second route to the destination. `DrumKitPlayer.initSynths()` returns false and builds nothing
  when the Mixer has no graph (asserted: no triggers, nothing connected to the destination).
- `MasterVolumeControl`, `IMasterVolumeControl` and the `volumeControl` scheduler option are deleted. `getVolume()`,
  `setVolume()` and `setVolumeImmediate()` delegate to `audioMixer.getMasterVolume()` / `setMasterVolume()`, and
  `AudioMixerState.master` is `{ volume }` with no `muted`. Clamp coverage (0.0, 1.0, out-of-range, ramped writes) now lives
  in `src/audio/__tests__/AudioMixer.test.ts` under "Volume Controls & Clamping".
- Built-in drum voices are constructed eagerly as one rig per Drum Lane per mode (`rig:<lane>:<mode>:<voice>`, plus
  `rig:<lane>:<mode>:sample` for a stored sample), each wired onto `getChannelNode(lane)` or `getAuditionNode(lane)`. The
  kit suite asserts a real trigger per lane and that the same voice on the other lane is a different node.
- `src/__tests__/AppAudioGraph.test.tsx` owns the shell half: mounting `App` yields exactly one graph whose single Master is
  the only thing connected to the destination; a `StrictMode` double mount does not stack a second graph; unmounting releases
  the graph. `src/App.tsx` keeps the scheduler in a ref (constructed once per mounted shell) and disposes it in the effect
  cleanup, so a remount re-acquires a live scheduler instead of leaking one — `dispose()` now also releases the click voice
  it built so the re-acquired graph is complete.
- `src/storage/__tests__/StorageSerialization.test.ts` and `src/components/__tests__/DawsonOrchestrationSection.test.tsx` no
  longer inject stand-in nodes: they run the real `AudioMixer` + `DrumKitPlayer` build against the registered fake, and the
  Storage suite also proves the custom-sample upload → decode → playback path routes through the channel nodes it claims to
  wire.

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Implementation Decisions 1 and 2, Testing Decisions seam 1, regression guard). ADR-0005 is binding here, including the StrictMode and Android AudioContext-at-page-load consequences.
