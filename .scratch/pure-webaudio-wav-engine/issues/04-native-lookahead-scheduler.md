# 04: Native Lookahead Scheduler (retiring `Tone.Transport` & `Tone.Draw`)

**What to build:** Replace `Tone.Transport` and `Tone.Draw` with a native `setInterval` + `AudioContext.currentTime` Lookahead Scheduler that preserves `MeasurePlan` zero-allocation ticks, tempo ramps, Gap Clicks, stochastic muting, and Playhead / beat-readout synchronization.

**Blocked by:** 02-pure-webaudio-mixer-and-sample-player

**Status:** ready-for-agent

- [ ] Native Lookahead Scheduler schedules beats and subdivisions against `AudioContext.currentTime` without `Tone.Transport`.
- [ ] Tempo ramps, Gap Clicks, stochastic muting, Ostinato, and Dawson System `MeasurePlan` execution preserve exact beat cadence and measure boundaries.
- [ ] Playhead and beat-readout UI callbacks synchronize with scheduled audio time without blocking the audio thread.
- [ ] Stopping the scheduler halts the lookahead timer and drains all active `AudioBufferSourceNode` instances cleanly.
- [ ] `npm run check` passes cleanly.
