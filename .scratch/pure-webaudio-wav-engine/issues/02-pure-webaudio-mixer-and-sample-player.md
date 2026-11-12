# 02: Pure Web Audio Mixer & per-hit `.wav` sample player

**What to build:** Migrate the Mixing Channels (`Click`, `Ostinato`, `Orchestration`) and their `Audition` nodes to native `GainNode` chains feeding the master headroom + limiter bus (~10 persistent nodes total), and replace all live synth rings (`MetalSynth`, `MembraneSynth`, `NoiseSynth`, `Synth`) and `Tone.ToneBufferSource` with per-stroke native `AudioBufferSourceNode` → per-hit `GainNode` playback that self-cleans in `onended` and decodes Sample Bank `.wav` uploads via native `AudioContext.decodeAudioData`.

**Blocked by:** 01-native-webaudio-context-and-fake-seam

**Status:** resolved

- [x] `AudioMixer` builds ~10 persistent native Web Audio nodes (3 Mixing Channels, 3 Audition nodes, master headroom gain, master `DynamicsCompressorNode` limiter) with zero Tone.js synth nodes.
- [x] Overlapping `.wav` hits on the same voice receive independent per-hit `GainNode` velocities without stepping on prior hits or cutting off tails prematurely.
- [x] `onended` disconnects finished `AudioBufferSourceNode` and per-hit `GainNode` instances, and `stop()` stops and disconnects all still-active sources immediately.
- [x] Sample Bank custom `.wav` uploads decode through native `AudioContext.decodeAudioData` and route through their voice's Mixing Channel (or Audition node when previewed).
- [x] `npm run check` passes cleanly.
