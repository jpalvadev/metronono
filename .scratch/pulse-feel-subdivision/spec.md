# Quarter-Note Pulse & Pulse Feel Selector

Status: done

## Problem Statement

Currently, the Metronome treats every written subdivision of the denominator (`beatUnit`) as a separate click and beat button. In meters such as `15/16`, `7/8`, `21/16`, and `6/8`, this produces 15, 7, 21, or 6 fast clicks and beat buttons per measure instead of the drummer's felt pulse. In practice, drummers feel `15/16` as 4 quarter-note pulses (`4 + 4 + 4 + 3` sixteenth notes), `7/8` as 4 quarter-note pulses (`2 + 2 + 2 + 1` eighth notes), `21/16` as 6 quarter-note pulses, and `6/8` as either 3 quarter-note pulses (straight feel) or 2 dotted-quarter pulses (triplet/compound feel), while keeping BPM anchored to quarter notes per minute. In addition, when the final pulse of an odd meter is shorter than a full pulse, unclipped Gap Clicks would spill past the measure boundary into the next bar's downbeat.

## Solution

Decouple the Metronome's **Pulse Feel** from the written `N/D` time signature while keeping **BPM** anchored to quarter notes per minute (`quarter-note = BPM`). Add a Pulse Feel selector alongside the Numerator (`1`–`32`) and Denominator (`2`, `4`, `8`, `16`) controls with two options: **Straight (`2 × 8th`)** (1 quarter-note pulse = `1.0` quarter note) and **Triplet (`3 × 8th`)** (1 dotted-quarter pulse = `1.5` quarter notes). Compute the number of pulses (and beat buttons) per measure as `ceil(measureQuarterNotes / pulseQuarterNotes)`. Each pulse fires on the pulse grid (`0, 1, 2, ...` pulse units), and the measure wraps at the exact `N/D` duration so any fractional remainder truncates the final pulse before the next bar's downbeat `1`. Clip Gap Clicks so any subdivision click that would land on or past the measure boundary is suppressed.

## User Stories

1. As a drummer, I want BPM to always represent quarter notes per minute across all time signatures and pulse feels, so that my tempo reference stays consistent when switching between `4/4`, `6/8`, `7/8`, `15/16`, and `21/16`.
2. As a drummer, I want a Pulse Feel selector with **Straight (`2 × 8th`)** and **Triplet (`3 × 8th`)** options alongside the time signature numerator and denominator, so that I can choose whether a measure is pulsed in quarter notes or dotted-quarter notes.
3. As a drummer, I want `15/16` in Straight feel to show 4 beat buttons (`1, 2, 3, 4`) with beat 1 as the downbeat and beats 2–4 as regular beats, wrapping to beat 1 after 3 sixteenth notes on beat 4 (`4 + 4 + 4 + 3` sixteenths).
4. As a drummer, I want `7/8` in Straight feel to show 4 beat buttons (`1, 2, 3, 4`) wrapping after 1 eighth note on beat 4 (`2 + 2 + 2 + 1` eighths), and `21/16` in Straight feel to show 6 beat buttons wrapping after 1 sixteenth note on beat 6.
5. As a drummer, I want `6/8` to show 3 beat buttons in Straight feel (`2 × 8th` per pulse) and 2 beat buttons in Triplet feel (`3 × 8th` per pulse), while keeping quarter-note = BPM.
6. As a drummer, I want each pulse button to retain individual click-to-mute (`ON`/`OFF`), and for existing mute states to be preserved (expanded or truncated) when changing the time signature or Pulse Feel.
7. As a drummer, I want Gap Clicks to subdivide each active pulse proportionally and suppress any gap click that would fall on or past the measure boundary, so that subdivisions never collide with or spill past the next bar's downbeat.
8. As a drummer, I want changing the Pulse Feel or time signature while the Metronome is playing to reschedule immediately without requiring a stop/start cycle.
9. As a drummer, I want Tempo Ramp and Dropout Mode bar counting to continue advancing accurately per measure across fractional-remainder meters.

## Implementation Decisions

- **Pulse Feel Domain Model**: Add a `PulseFeel` setting (`'straight'` = 2 eighth notes / `1.0` quarter note per pulse, `'triplet'` = 3 eighth notes / `1.5` quarter notes per pulse; default `'straight'`) to the Metronome domain engine with getter/setter and change notification or integration into beat-mask resizing.
- **Pulse Count & Remainder Duration**:
  - Total measure length in quarter notes: `measureQuarters = beats * (4 / beatUnit)`.
  - Nominal pulse length in quarter notes: `pulseQuarters = pulseFeel === 'triplet' ? 1.5 : 1.0`.
  - Pulses per measure (and beat button count): `Math.max(1, Math.ceil(measureQuarters / pulseQuarters))`.
  - Each pulse index `i` (`0 .. pulseCount - 1`) starts at offset `i * pulseQuarters` within the measure, and its actual duration in quarter notes is `Math.min(pulseQuarters, measureQuarters - i * pulseQuarters)` (with floating-point epsilon guard so exact integer divisions do not create a spurious extra pulse).
- **Beat Mask Resizing**: Resizing the beat mask in the Metronome engine uses the computed pulse count (`getPulsesPerMeasure()`) rather than raw `timeSignature.beats`, preserving existing entries when expanding or truncating on either time signature or Pulse Feel changes.
- **Variable-Interval Lookahead Scheduling**:
  - Because the final pulse of an odd/fractional measure (e.g., beat 4 of `15/16`) is shorter than a nominal pulse, the transport scheduler advances each tick by the *current* pulse's actual duration `(actualPulseQuarters) * (60 / bpm)` rather than a fixed `beatUnit` interval.
  - Extend the lookahead transport interface (or scheduling mechanism) so each scheduled pulse schedules the next pulse at its exact audio-clock time, or dynamically computes each step's interval from the current pulse duration.
- **Gap Clicks Clipping**:
  - Within a pulse of nominal duration `nominalSec = pulseQuarters * (60 / bpm)` and actual remaining measure duration `actualSec = actualPulseQuarters * (60 / bpm)`, Gap Clicks with `divisions` split `nominalSec` evenly (`gap / divisions * nominalSec`).
  - Any gap click whose offset `>= actualSec - epsilon` is suppressed so subdivisions never land on or past the next bar's downbeat.
- **Metronome UI**:
  - Add a Pulse Feel control (`Straight (2×8th)` / `Triplet (3×8th)`) next to the Numerator and Denominator selectors in the Metronome card.
  - Render one beat button per computed pulse (`pulseCount`) rather than raw `timeSignature.beats`.
- **4/4 Exercise Gate Compatibility**:
  - Keep the existing non-destructive `4/4` gate for Reading View, Ostinato, and Dawson System orchestration (active only when `beats === 4 && beatUnit === 4 && pulseFeel === 'straight'`, or strictly `4/4` straight; if `pulseFeel === 'triplet'` in `4/4`, treat as non-straight-`4/4` or clarify if needed — default `'straight'` preserves `4/4` behavior).

## Testing Decisions

Tests assert external, user-observable behavior at the highest available seams without coupling to internal helpers:

- **Metronome Engine Seam**: Verify pulse count, per-pulse start offset and actual duration (including fractional remainders for `15/16`, `7/8`, `21/16`, `6/8` Straight vs. Triplet), quarter-note = BPM timing, and beat-mask preservation across Pulse Feel and time signature changes.
- **Transport Scheduler + Lookahead Seam**: Verify exact audio-clock timestamps across bar boundaries (e.g., `15/16` Straight at 120 BPM firing at `0.0, 0.5, 1.0, 1.5, 1.875, 2.375, ...`), `6/8` Triplet firing every `0.75s` at 120 BPM, Gap Clicks clipping at truncated final beats, and immediate rescheduling when switching Pulse Feel during playback.
- **Metronome UI Seam**: Verify selecting Straight vs. Triplet updates the rendered beat button count (`15/16` Straight → 4 buttons, `6/8` Straight → 3 buttons, `6/8` Triplet → 2 buttons, `21/16` Straight → 6 buttons) and per-beat mute toggling works for each pulse button.

## Out of Scope

- Asymmetric custom grouping accents (e.g., `2+2+3` vs `3+2+2` in `7/8`).
- Adapting Reading Line, Ostinato, or Dawson System exercises to non-`4/4` meters or Triplet pulse feel.
- Changing BPM away from quarter notes per minute.

## Further Notes

- [GLOSSARY.md](file:///c:/Programacion/metronono/GLOSSARY.md) has been updated for `Metronome` and `Gap Clicks` to reflect quarter-note = BPM, Straight (`2 × 8th`) vs. Triplet (`3 × 8th`) pulse feel, fractional-remainder bar wrapping, and Gap Clicks boundary clipping.
