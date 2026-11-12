# 01: Native Web Audio context & test fake seam

**What to build:** Introduce the native Web Audio runtime context seam (single lazily-unlocked `AudioContext`, master headroom `GainNode`, and `DynamicsCompressorNode` brickwall limiter) alongside a recording fake `AudioContext` test harness, keeping existing Tone.js callers compiling and green while the migration proceeds.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A single native `AudioContext` provider handles lazy creation, resume-on-gesture, and `decodeAudioData` without Tone.js.
- [ ] A recording fake `AudioContext` test harness captures `GainNode`, `DynamicsCompressorNode`, and `AudioBufferSourceNode` creation, routing, scheduled `start`/`stop`, and `onended` lifecycle.
- [ ] `npm run check` passes cleanly with all existing tests green.
