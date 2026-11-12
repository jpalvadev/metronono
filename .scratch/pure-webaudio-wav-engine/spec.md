Status: ready-for-agent

# Pure Web Audio WAV Sample Engine

## Problem Statement

When practicing with the Metronome, Ostinato, and Dawson System orchestration, users experience severe audio clipping, crackles, buffer underruns, and cut-off `.wav` samples even on high-end desktop hardware. The underlying cause is an oversized live-synthesizer graph (~4,675 Web Audio nodes instantiated eagerly at page load plus ~100+ new internal nodes allocated per second during playback), combined with Tone.js / `standardized-audio-context` per-hit overhead and shared gain nodes that introduce step-gain pops when `.wav` hits overlap.

## Solution

Replace the entire Tone.js live-synthesizer audio runtime with a lightweight, pure Web Audio `.wav` sample engine:

- Eliminate all live synthesized drum and metronome instruments (`MetalSynth`, `MembraneSynth`, `NoiseSynth`, `Synth`) and remove `Tone.js` from the runtime audio path.
- Load and decode default `.wav` assets once per voice from `public/samples/<voiceId>.wav` into cached `AudioBuffer` instances, with user overrides from the Sample Bank taking precedence and zero synthesized fallback if a `.wav` is missing.
- Play every stroke through a single native `AudioBufferSourceNode` → per-hit `GainNode` chain routed into the target Mixing Channel (or its Audition node), with automatic self-disconnection in `onended`, natural polyphony, and zero shared per-voice gain discontinuities.
- Route all three Mixing Channels (`Click`, `Ostinato`, `Orchestration`) and their `Audition` nodes through a master headroom gain and `DynamicsCompressorNode` brickwall limiter before `AudioContext.destination`, keeping the persistent audio graph under ~10 nodes.
- Drive timing via a native `setInterval` + `AudioContext.currentTime` Lookahead Scheduler that preserves Measure Plan zero-allocation ticks, tempo ramps, Gap Clicks, stochastic muting, and Playhead draw synchronization.

## User Stories

1. As a drummer, I want the audio engine to keep a tiny persistent node graph (~10 nodes instead of ~4,675), so that Web Audio never suffers buffer underruns or crackles on my machine.
2. As a drummer, I want all 12 drum voices and 3 metronome click voices to use `.wav` samples from `public/samples/<voiceId>.wav` by default, so that I hear clean acoustic/sampled sounds without heavy live synths.
3. As a drummer, I want custom `.wav` samples uploaded in the Sample Bank to override the default `.wav` for that voice, so that I can customize my kit and click sounds.
4. As a drummer, I want overlapping `.wav` hits on the same voice (such as fast snare doubles or ride ostinatos) to play with full tails and independent per-hit velocities, so that no hit cuts off or clicks the previous hit.
5. As a drummer, I want `.mp3` files excluded from default `public/samples/` assets, so that MP3 encoder padding never introduces attack timing offsets on beat transients.
6. As a drummer, I want a voice whose `.wav` file is missing from `public/samples/` (and has no Sample Bank override) to stay silent with a console warning rather than falling back to a synthesizer, so that the app never reintroduces synth overhead.
7. As a drummer, I want simultaneous Click, Ostinato, and Orchestration hits to pass through a master headroom stage and brickwall limiter, so that summing multiple loud transients never clips digitally above 0 dBFS.
8. As a drummer, I want muting a Mixing Channel (`Click`, `Ostinato`, or `Orchestration`) to silence scheduled playback on that channel immediately without affecting the Metronome clock, notation, or other channels.
9. As a drummer, I want Audition taps in the Sample Bank or editors to play through the channel's Audition node at that channel's volume even when the Mixing Channel is muted.
10. As a drummer, I want stopping the transport to stop any still-playing scheduled `AudioBufferSourceNode` instances cleanly without leaving dangling audio tails behind the mixer.
11. As a drummer, I want tempo ramps, Gap Clicks, stochastic muting, and Measure Plan execution to preserve exact hardware-clock timing via the native Lookahead Scheduler.
12. As a drummer, I want the Playhead and beat readouts to stay synchronized with the scheduled audio time without blocking the audio thread.
13. As a developer, I want a clear document (`public/samples/README.md`) listing all 15 expected `.wav` filenames and their voice mappings, so that I know exactly which files to place in `public/samples/`.

## Implementation Decisions

- **Pure Web Audio Runtime (No Tone.js):** Remove `Tone.js` and `standardized-audio-context` from the audio mixer, drum player, scheduler, and sample decoding pipeline. Use a single lazily-unlocked native `AudioContext` owned by the audio mixer/scheduler boundary.
- **Persistent Mixer Graph (~10 Nodes):** The mixer owns one master headroom `GainNode`, one master `DynamicsCompressorNode` configured as a fast-attack brickwall limiter connected to `AudioContext.destination`, and three Mixing Channel + Audition `GainNode` pairs (`click`, `ostinato`, `orchestration`). All six channel/audition gains feed the master headroom gain.
- **WAV-Only Default Asset Loader:** On startup (or first audio context initialization), fetch and decode `public/samples/<voiceId>.wav` for each of the 15 canonical voices (12 drum voices, 3 metronome click voices) into an in-memory `AudioBuffer` map. Reject `.mp3` default paths; if a fetch or decode fails, log a warning once and leave that voice unpopulated (silent unless a Sample Bank custom `.wav` is loaded).
- **Per-Stroke Sample Playback & Cleanup:** Each triggered stroke creates one native `AudioBufferSourceNode` and one per-hit `GainNode` set to the stroke's velocity, connects `source -> hitGain -> targetChannelNode`, schedules `source.start(audioTime)`, and registers `source.onended` to disconnect both `source` and `hitGain`. Active sources are tracked in a lightweight set so `stop()` can stop and disconnect all live sources immediately without relying on lookahead-time heuristics.
- **Zero-Allocation Native Lookahead Scheduler:** Replace `Tone.Transport` and `Tone.Draw` with a dedicated `setInterval` lookahead loop (e.g., 25 ms tick interval, 100 ms lookahead window against `AudioContext.currentTime`) that advances beat/measure cursors, applies tempo ramps and stochastic muting, reads pre-computed `MeasurePlan` buckets, and schedules UI/Playhead callbacks via `requestAnimationFrame` / `setTimeout` aligned to `AudioContext.currentTime`.
- **Sample Bank Storage Decoding:** Decode uploaded custom `.wav` files in `StorageManager` using the native `AudioContext.decodeAudioData` instead of `Tone.getContext().rawContext`, keeping Sample Bank overrides and default `public/samples/` buffers as standard Web Audio `AudioBuffer` objects.
- **UI Sample Bank Alignment:** Update Sample Bank modal file-input accept filters to `.wav` (or `.wav,audio/wav`) to match the WAV-only contract if appropriate, while keeping existing IndexedDB/Capacitor persistence compatible with stored `.wav` blobs.

## Testing Decisions

- **Unit & Integration Seam (Vitest + Native Web Audio Fake):** Replace the `fakeTone` test harness with a lightweight recording fake `AudioContext` (recording persistent `GainNode` / `DynamicsCompressorNode` topology, `AudioBufferSourceNode` start/stop/onended lifecycles, and `decodeAudioData` calls). Tests assert external behavior only:
  - Persistent node count stays bounded (~10 nodes, 0 synth nodes).
  - Every Mixing Channel and Audition node routes through the master headroom + limiter to `destination`.
  - Default `.wav` assets load per voice, missing `.wav` files stay silent without throwing, and Sample Bank overrides take precedence.
  - Overlapping hits on the same voice get independent per-hit gain nodes, never cut each other off early, and clean up on `ended` or `stop()`.
  - Lookahead Scheduler advances beats accurately across tempo ramps, Gap Clicks, Measure Plans, and Playhead draw callbacks.
- **Real Browser Seam (`npm run check:live`):** Update the Playwright live-audio guard to assert the new tiny node budget (e.g., < 50 `GainNode`s at load instead of 5,000), beat cadence at configured BPM, `AudioBufferSourceNode.start` firing per beat when `.wav` samples are present, zero clipping (`maxPeak < 1.0` via `AnalyserNode`), and a clean console.
- **Full Verification:** Both `npm run check` (`one-style`, `tsc --noEmit`, `vitest run`) and `npm run check:live` must pass.

## Out of Scope

- Generating or bundling synthesized/procedural fallback audio inside the app for missing `.wav` files.
- Supporting `.mp3`, `.ogg`, or `.flac` as default assets in `public/samples/`.
- Redesigning the VexFlow notation renderers, Dawson System domain model, or Partiture Formula editor UI.

## Further Notes

- Supersedes the Tone.js live-synth voice pool in ADR-0011 and the Tone.js runtime choice in ADR-0004/ADR-0005, as recorded in ADR-0014.
- Expected default `.wav` filenames and voice mappings are documented in `public/samples/README.md`.
