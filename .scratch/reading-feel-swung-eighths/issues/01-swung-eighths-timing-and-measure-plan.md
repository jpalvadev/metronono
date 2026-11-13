# 01: Swung Eighths Audio Timing and Measure Plan

**What to build:** Add `ReadingFeel` (`'straight'` | `'swing'`, defaulting to `'straight'`) to the audio transport and orchestration domain. When set to `'swing'`, eighth-note upbeats in 4/4 reading lines schedule at the third triplet of each beat (`beat + 2/3`, approximately 0.667, 1.667, 2.667, 3.667), locking in with the `Jazz Swing` ride cymbal ostinato, while downbeats remain at whole beat offsets (0.0, 1.0, 2.0, 3.0). Changing reading feel rebuilds the pre-resolved Measure Plan immediately. Orchestration formulas mapped to reading notes trigger at the note's onset time and execute their strokes with nominal duration ratios without elastic distortion.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Export `ReadingFeel` type (`'straight'` | `'swing'`) from the domain rhythm/audio types.
- [x] Implement `getReadingFeel()`, `setReadingFeel(feel)`, and `onReadingFeelChange(listener)` in `ToneTransportScheduler` and `DawsonEngine`.
- [x] In `buildMeasurePlans` and `resolveOrchestrationEvents`, transform eighth-note upbeats (fractional offset ~0.5) to `beat + 2/3` when `readingFeel === 'swing'`.
- [x] Keep downbeats (fractional offset 0.0) and other non-upbeat subdivisions at their nominal offsets.
- [x] Rebuild the Measure Plan eagerly whenever `readingFeel` changes.
- [x] Ensure Dawson orchestration formulas trigger starting at the note's onset time with nominal stroke durations (zero elastic distortion).
- [x] Decouple 4/4 Measure Plan creation from the Metronome's compound meter `pulseFeel`, so 4/4 meter remains active during swing feel.
- [x] Unit and scheduler tests verify timing offsets for straight vs swing feel, formula trigger times, and Measure Plan rebuilding.
