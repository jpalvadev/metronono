# 05: Retire `Tone.js` dependency & tighten `check:live` browser guard

**What to build:** Remove `tone` from runtime dependencies and retire the `fakeTone` test scaffolding, then update `npm run check:live` in real Chromium to enforce the tiny persistent node budget (< 50 `GainNode`s at load), beat cadence, `AudioBufferSourceNode` playback without early cutoffs, and zero clipping (`maxPeak < 1.0`).

**Blocked by:** 03-default-wav-asset-loader, 04-native-lookahead-scheduler

**Status:** ready-for-agent

- [ ] `tone` is removed from `package.json` and no runtime or test file imports `tone` or `fakeTone`.
- [ ] `npm run check:live` asserts < 50 `GainNode`s at load, accurate BPM cadence, clean console, and zero clipping (`maxPeak < 1.0`) in real Chromium.
- [ ] `npm run check` and `npm run check:live` both pass green.
