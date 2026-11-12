# Pure Web Audio WAV Sample Engine (Removing Tone.js and Live Synths)

**Status:** accepted (supersedes the synth voice pool in ADR-0011 and the Tone.js audio runtime in ADR-0004/ADR-0005)

## Context

The Tone.js audio graph eagerly instantiated ~4,675 Web Audio nodes at page load (primarily from `MetalSynth`, `MembraneSynth`, and `NoiseSynth` rings) and allocated ~100+ internal `standardized-audio-context` nodes per second during playback. On real hardware this saturated the 128-sample Web Audio render quantum, causing buffer underruns (audible clicks, cuts, and distortion), while sharing a single `Tone.Gain` per custom sample caused step-gain pops on overlapping hits.

## Decision

1. **Zero live synths:** Remove `Tone.js` (`tone` and `standardized-audio-context`) and all synthesized drum/click instruments from the audio runtime.
2. **WAV-only Sample Bank:** Default sounds for all 15 voices (12 drum voices + 3 metronome click voices) are loaded and decoded once from `public/samples/<voiceId>.wav`. MP3s are rejected for default assets to avoid encoder-padding attack latency. Missing `.wav` files log a warning and remain silent without synthesizing.
3. **Pure Web Audio graph + native Lookahead Scheduler:**
   - `AudioMixer` owns a single native `AudioContext`, a master headroom `GainNode`, a `DynamicsCompressorNode` brickwall limiter before `destination`, and the three Mixing Channel + Audition `GainNode` pairs (~8–10 persistent nodes total).
   - Each stroke creates a lightweight native `AudioBufferSourceNode` → per-hit `GainNode` (preserving per-stroke velocity without stepping on overlapping tails) and disconnects itself in `onended`.
   - Timing is driven by a native `setInterval` + `AudioContext.currentTime` Lookahead Scheduler.

## Consequences

- Idle audio graph drops from ~4,675 nodes to ~10 persistent nodes.
- All 15 default `.wav` files must exist in `public/samples/` (documented in `public/samples/README.md`) for out-of-the-box audio; voices without a `.wav` file stay silent until provided or uploaded via Sample Bank.
