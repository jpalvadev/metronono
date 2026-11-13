# Time Signature Selector & 4/4 Exercise Gate

Status: ready-for-agent

## Problem Statement

The Metronome currently restricts time signature selection to only `4/4` and `3/4`, preventing drummers from practicing odd, compound, or complex meters such as `7/8`, `15/16`, `21/16`, `6/4`, `5/8`, `10/16`, and `5/4`. In addition, the Metronome UI includes four quick-beat preset buttons (`All`, `2 & 4 (Jazz)`, `1 & 3`, `1 Only`) that clutter the beat selector and are specific to `4/4` phrasing. Meanwhile, Gap Clicks and drum scheduling in the transport scheduler compute beat duration using quarter-note spacing instead of scaling by the time signature's beat unit, and the `4/4`-only Reading Line, Ostinato, and Dawson System exercises continue to play and advance their Playhead even when the Metronome is set to a non-`4/4` meter.

## Solution

Replace the fixed `4/4` and `3/4` toggle in the Metronome with a paired Numerator (`1`–`32`) and Denominator (`2`, `4`, `8`, `16`) selector so any `N/D` time signature can be chosen directly. Remove the `All`, `2 & 4 (Jazz)`, `1 & 3`, and `1 Only` preset buttons and all references to them, while preserving per-beat click-to-mute on the beat buttons and allowing those buttons to wrap cleanly for large numerators (`15/16`, `21/16`, etc.). Align the scheduler's beat duration calculation with the lookahead transport (`(4 / beatUnit) * (60 / bpm)`, keeping quarter-note = BPM) so Gap Clicks scale accurately with the denominator. Finally, enforce a non-destructive `4/4` exercise gate: whenever the Metronome is in any time signature other than `4/4`, Ostinato, Dawson System orchestration, and Reading View playback/Playhead are suspended (producing no drum strokes and showing a `"4/4 only"` indicator) while preserving the user's selections so they automatically resume upon returning to `4/4`.

## User Stories

1. As a drummer, I want to select any time signature numerator from `1` to `32` and denominator from `2`, `4`, `8`, or `16` in the Metronome, so that I can practice meters like `7/8`, `15/16`, `21/16`, `6/4`, `5/8`, `10/16`, and `5/4`.
2. As a drummer, I want the Metronome beat display to show the exact number of beats for the selected numerator and wrap cleanly across rows for large numerators like `15` or `21`, so that all beat buttons remain readable and clickable without overflowing the card.
3. As a drummer, I want to click any individual beat button to mute or unmute that beat in any time signature, so that I can still customize accents and rests per beat.
4. As a drummer, I want the `All`, `2 & 4 (Jazz)`, `1 & 3`, and `1 Only` preset buttons and all mentions of them removed, so that the Metronome beat area is uncluttered and meter-agnostic.
5. As a drummer, I want BPM to represent quarter-note tempo across all time signatures (`7/8` clicking eighth notes at `(4 / 8) * (60 / bpm)` and `15/16` clicking sixteenth notes at `(4 / 16) * (60 / bpm)`), so that tempos feel consistent with standard musical notation.
6. As a drummer, I want Gap Clicks to subdivide the active beat duration proportionally to the denominator (`beatUnit`), so that gap clicks remain evenly spaced in `7/8`, `15/16`, `6/4`, and `4/4` alike.
7. As a drummer, I want changing the time signature while the Metronome is playing to reschedule the click immediately in the new meter without requiring a stop/start cycle.
8. As a drummer, I want Ostinato and Dawson System orchestration audio to be automatically suspended whenever any time signature other than `4/4` is selected, so that `4/4` drum patterns do not clash with odd or non-`4/4` meters.
9. As a drummer, I want the Reading View Playhead and exercise playback to be suspended whenever any time signature other than `4/4` is selected, so that a `4/4` Reading Line does not advance out of sync with a non-`4/4` click.
10. As a drummer, I want a clear `"4/4 only"` indicator in the Dawson Orchestration and Reading View sections when a non-`4/4` meter is active, so that I understand why those sections are suspended.
11. As a drummer, I want my selected Ostinato, Dawson System, and Reading Line to be preserved while practicing in a non-`4/4` meter and automatically restored when I switch back to `4/4`, so that I do not lose my practice setup.

## Implementation Decisions

- **Metronome Domain Validation**: Enforce valid time signature bounds in the Metronome engine (`beats` clamped to integer `1`–`32`, `beatUnit` restricted to `2`, `4`, `8`, `16`), preserving existing beat mask entries when expanding or truncating to the new beat count.
- **Time Signature Selector UI**: Replace the `4/4` and `3/4` toggle buttons in the Metronome component with a paired Numerator input/stepper (`1`–`32`) and Denominator selector (`2`, `4`, `8`, `16`).
- **Beat Selector Wrapping**: Update the beat buttons container in the Metronome component to wrap (`flex-wrap`) and use compact button dimensions when `beats > 8` so meters up to `32` beats fit within the card without horizontal overflow.
- **Preset Removal**: Remove the `All`, `2 & 4 (Jazz)`, `1 & 3`, and `1 Only` buttons, their handler, and all references/tests for them.
- **Quarter-Note BPM & Gap Click Scaling**: Align the transport scheduler's `beatDuration` calculation with the lookahead transport formula `(4 / beatUnit) * (60 / bpm)` so Gap Clicks subdivide the actual beat-unit duration rather than assuming a quarter-note beat.
- **Scheduler Time Signature Subscription**: Expose a time-signature change subscription on the transport scheduler so UI sections (Dawson Orchestration, Reading View) react immediately when the time signature changes.
- **Non-Destructive 4/4 Exercise Gate**:
  - In the transport scheduler, treat `beats === 4 && beatUnit === 4` as the only meter in which a Measure Plan is built and drum events (Ostinato and Dawson System orchestration) are scheduled. In any other meter, skip building/playing Measure Plan drum events without clearing the underlying Dawson engine's Ostinato, Dawson System, or Reading Line.
  - In the Dawson Orchestration and Reading View components, subscribe to the scheduler's time signature and render a non-destructive `"4/4 only"` suspended state (disabling interactive exercise controls / suppressing the Reading View Playhead) whenever the time signature is not `4/4`, restoring normal behavior automatically when `4/4` is re-selected.

## Testing Decisions

Tests should assert external, user-observable behavior through the highest available seam (domain engine, transport scheduler with fake Web Audio, and rendered React components) without coupling to internal private helpers:

- **Metronome Engine**: Verify arbitrary `N/D` time signatures (`7/8`, `15/16`, `21/16`, `6/4`, `5/8`, `10/16`, `5/4`), clamping/validation of out-of-range numerators/denominators, and beat mask resizing.
- **Transport Scheduler**: Verify `beatUnit` intervals (`8n`, `16n`, `2n`), Gap Clicks timing scaled by `4 / beatUnit`, rescheduling on time signature change, Measure Plan suppression when time signature ≠ `4/4`, and automatic resumption of Ostinato/Orchestration when returning to `4/4` without losing the configured system/ostinato.
- **Metronome UI**: Verify selecting arbitrary `N/D` signatures via the numerator and denominator controls, rendering the matching number of beat buttons, absence of `All`, `2 & 4 (Jazz)`, `1 & 3`, and `1 Only` buttons, and individual beat mute toggling.
- **Dawson Orchestration & Reading View UI**: Verify `"4/4 only"` suspended indicator and Playhead suppression when time signature ≠ `4/4`, and automatic restoration with preserved selections when switching back to `4/4`.

## Out of Scope

- Adapting Ted Reed Reading Line generation, Reading Score rendering, or Dawson Ostinatos to non-`4/4` meters.
- Asymmetric beat-grouping accents (e.g., `2+2+3` grouping indicators for `7/8`) beyond per-beat muting.
- Persisting Metronome time signature across page reloads (tracked separately under storage persistence).

## Further Notes

- Existing `GLOSSARY.md` entries for `Reading Line`, `Ostinato`, `Dawson System`, and `Metronome` have been updated to document the arbitrary time signature support and the non-destructive `4/4` exercise gate.
