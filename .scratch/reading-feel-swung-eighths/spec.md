Status: completed

# Reading Line Rhythmic Feel: Straight vs Swung Eighths (Jazz Swing)

## Problem Statement

When drummers practice Alan Dawson drum interpretation systems and sight-reading melodies (such as Ted Reed's *Syncopation*) over a jazz ride cymbal ostinato, written eighth notes sound out of place when played straight. The built-in `Jazz Swing` ostinato articulates a classic triplet swing ride cymbal pattern ("ding ding-a ding ding-a ding"), where the skip beats fall on the third triplet of beats 2 and 4 (offsets 1.667 and 3.667 in 4/4). Because single-line reading notes currently only schedule at binary subdivisions (half-beat offsets `beat + 0.5`), every upbeat clashes with the swung ride cymbal, destroying the groove and confusing the drummer.

Furthermore, setting the Metronome's `Pulse Feel` to `triplet` does not solve this: it redefines the entire metronome grid into compound meter (dotted-quarter pulses of 1.5 quarter notes) and immediately suspends the Reading Line and Dawson engine because they require 4/4. Drummers need written 4/4 reading lines to sound with a swung eighth-note feel while keeping standard 4/4 metric pulses and authentic Ted Reed sheet notation.

## Solution

1. Introduce an independent **Reading Feel** setting (`'straight'` | `'swing'`, defaulting to `'straight'`) for the Reading Line and Dawson Orchestration in 4/4 time.
2. In **Straight** feel:
   - On-beat downbeats sound at whole beats ($0.0, 1.0, 2.0, 3.0$).
   - Off-beat upbeats ("&") sound at half-beats ($0.5, 1.5, 2.5, 3.5$).
3. In **Swing** feel:
   - On-beat downbeats sound at whole beats ($0.0, 1.0, 2.0, 3.0$).
   - Off-beat upbeats ("&") sound at the third triplet of each beat ($+2/3 \approx 0.667, 1.667, 2.667, 3.667$), aligning perfectly with the skip beat of the `Jazz Swing` ride cymbal ostinato.
   - The reading line remains fully active in 4/4 time (never suspended by swing feel).
4. Preserve visual notation:
   - The score rendered by `ReadingScoreRenderer` retains standard Ted Reed 4/4 straight eighth notes.
   - When Swing feel is active, render a clear `Swing (♫ = ♩♪)` indicator on the score header.
5. Deterministic formula execution (zero elastic distortion):
   - Formulas mapped to reading notes begin execution at the note's calculated onset time (downbeat or $+2/3$ upbeat).
   - Internal strokes play with their nominal, static duration ratios without artificial compression or time-warping.
6. UI Controls:
   - Expose a clean `Feel: Straight | Swing` control in the Single-Line Reading training controls, synced with the audio transport and remembered across the practice session.

## User Stories

1. As a jazz drummer, I want to toggle between Straight and Swing feel on the single-line reading score, so that I can practice reading over both straight and swing grooves.
2. As a drummer playing over the Jazz Swing ostinato, I want eighth-note upbeats to sound on the third triplet of the beat, so that my reading melody locks in with the ride cymbal skip beat.
3. As a drummer, I want reading notes falling on downbeats (1, 2, 3, 4) to remain on the downbeat in both straight and swing feel, so that the quarter-note pulse remains rock-solid.
4. As a drummer, I want the visual score to remain in standard 4/4 notation with standard eighth notes regardless of feel, so that I develop real-world sight-reading skills matching published jazz and syncopation literature.
5. As a drummer, I want to see a `Swing (♫ = ♩♪)` indicator when swing feel is enabled, so that I have a clear visual reminder of how the notation is interpreted.
6. As a drummer, I want the single-line reading score and playhead to remain active and unsuspended in 4/4 when swing feel is chosen, so that I can play continuously.
7. As a drummer, I want the playhead cursor to reflect the rhythmic timing of the active feel, so that visual feedback matches the audio events.
8. As a drummer using Dawson orchestration formulas, I want notes assigned to upbeat triggers to start their drum formulas at the swung time, so that orchestration accents align with the jazz pulse.
9. As a drummer using multi-stroke formulas (e.g. rolls or rudiments), I want their internal strokes to play at their exact nominal durations without elastic distortion, so that the rudimental figures sound clean and musical.
10. As a drummer, I want changing the reading feel to rebuild the audio schedule immediately, so that the timing transition is instant without stopping playback.
11. As a drummer, I want the Metronome's pulse click to remain in standard 4/4 quarter-note clicks when reading in swing, so that my click reference is steady and not forced into compound meter.
12. As a drummer, I want my selected reading feel to persist during my practice session, so that switching exercises or regenerating reading lines does not revert my feel preference.

## Implementation Decisions

- **Reading Feel Domain Model**:
  - Define `type ReadingFeel = 'straight' | 'swing'`.
  - Add `readingFeel` state and getter/setter/listeners to the transport scheduler and orchestration engine.
  - Default `readingFeel` is `'straight'`.
- **Timing Transformation in Measure Plan**:
  - In `buildMeasurePlans` / `resolveOrchestrationEvents`, compute the onset time of each reading event in the measure based on `readingFeel`:
    - Given event offset in measure `t = currentOffsetBeats`:
    - Integer beat base: `beat = Math.floor(t)`.
    - Fractional part: `frac = t - beat`.
    - If `readingFeel === 'swing'` and `Math.abs(frac - 0.5) < 0.05` (eighth-note upbeat):
      - Transformed offset: `tSwung = beat + (2 / 3)`.
    - Otherwise (downbeats, quarter notes, straight feel): `tSwung = t`.
  - Scheduled events are bucketed into their whole beat bins using this transformed offset.
- **Orchestration Formula Dispatch**:
  - Formula strokes are scheduled starting at `tSwung + strokeOffset` with their declared `durationRatio`.
  - Zero elastic time warping: no scaling factor is applied to stroke durations.
- **Visual Score & Header**:
  - `ReadingScoreRenderer` accepts `readingFeel?: ReadingFeel` in its render options.
  - VexFlow engraving continues to render standard notes, rests, and beams.
  - A subtle badge/legend `Swing ♫ = ♩♪` is rendered above the stave or in the reading container header when `readingFeel === 'swing'`.
- **UI Integration in Reading Training Section**:
  - In `ReadingTrainingSection.tsx`, add a toggle/select alongside Mode/Page/Exercise: `Feel: Straight | Swing`.
  - Update `isFourFour` condition: `timeSignature.beats === 4 && timeSignature.beatUnit === 4` (no longer blocked by `pulseFeel === 'straight'`).
  - Wire changes to `scheduler.setReadingFeel(feel)` and listen for external changes.

## Testing Decisions

- **Behavioral testing only**: Tests will assert observable outputs — scheduled event timestamps, audio transport measure plan offsets, and rendered SVG text/badges — without asserting private state.
- **Target modules**:
  - `ToneTransportScheduler.test.ts`: verify that with `readingFeel = 'swing'`, upbeat reading events schedule at `beat + 2/3`, while downbeats schedule at `beat + 0.0`. Verify that switching feel rebuilds the plan.
  - `DawsonEngine.test.ts`: verify orchestration resolution with swung reading lines.
  - `ReadingScoreRenderer.test.ts`: verify that standard note SVG elements remain identical while the swing indicator appears when `readingFeel = 'swing'`.
  - `ReadingTrainingSection.test.tsx`: verify that selecting Swing feel does not show the "Suspended" badge in 4/4 and correctly forwards the feel to the scheduler.
- **Prior art**:
  - Existing `ToneTransportScheduler.test.ts` measure plan tests (`docs/adr/0011`).
  - `ReadingTrainingSection.test.tsx` time signature and pulse feel test coverage.

## Out of Scope

- Elastic tempo warping or time-stretching of internal formula strokes.
- Micro-timing swing ratios other than triplet shuffle ($2:1$).
- Notation conversion into explicit triplet rests/notes on the stave.
- Changes to compound meter handling in the Metronome engine (`pulseFeel = 'triplet'` remains 12/8 compound meter for metronome clicks).

## Further Notes

- This feature directly completes item 20 of `PENDING.md`.
- Conforms strictly to ADR-0015 and `GLOSSARY.md`.
