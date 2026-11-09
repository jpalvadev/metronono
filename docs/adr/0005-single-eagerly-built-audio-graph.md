# 0005. Single Eagerly-Built Audio Graph

The mixer sliders had no audible effect because the objects the UI talked to were not the objects the audio graph used: components call `getAudioMixer()` and `getDrumKitPlayer()` during the first render, which fabricated bare instances, and `ensureInitialized()` then skipped `initToneNodes()` and `initSynths()` because "an instance already exists". We decided that the scheduler builds one complete Tone graph per instance — Click, Ostinato and Orchestration gains feeding one Master gain feeding the destination — before any playback, and that its accessors only ever return those wired objects. Every voice is routed through its named Mixing Channel, and the `source` carried by a scheduled orchestration event decides which channel a stroke belongs to.

## Considered Options

- **Idempotent per-resource wiring inside `ensureInitialized()`**, separating "instance exists" from "graph is wired". Rejected: any component that touches an accessor before the first PLAY still receives an object with no nodes behind it, which is exactly the defect we are repairing.
- **Lazy construction kept, with the UI forced to call `start()` first.** Rejected: it makes render order a correctness requirement for the audio layer.

## Consequences

- `ToneMasterVolume` and `IMasterVolumeControl` are retired, and loudness lives only in the mixer: the Metronome panel has no volume or mute control of its own.
- The graph is built at scheduler construction, so Tone.js creates its AudioContext at page load on the Capacitor build, before any gesture. `Tone.start()` still gates audibility until PLAY, and a `graphBuilt` flag plus disposal on unmount keeps React 18 StrictMode from building two graphs.
- Tests must exercise the real wiring path, which jsdom cannot host: suites that assert graph shape use a recording fake Tone (`src/test/fakeTone.ts`) instead of a stubbed AudioContext.
- Audition deliberately bypasses Mixing Channel mutes, so a Sample Bank preview is always audible. This is a deliberate exception, not an inconsistency to fix.

Extends ADR-0004 (Tone.js as the audio transport).
