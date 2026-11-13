# Reading Feel: Swung Eighths Interpretation and Formula Dispatch

**Status:** accepted

## Context

The Reading Line and Dawson Orchestration are modeled on Ted Reed's *Syncopation*, written in standard 4/4 notation with eighth notes. When practicing jazz drumming over a `Jazz Swing` ride cymbal ostinato (which subdivides each beat into a 3-part triplet: ride on 1, ride+foot on 2, ride on the 3rd triplet of 2 and 4), reading eighth notes played straight (at `beat + 0.5`) clashes with the triplet feel. Previously, changing the Metronome's `Pulse Feel` to `triplet` switched the metronome clock to compound meter (dotted-quarter pulses) and completely suspended the Reading Line and Dawson engine because they require 4/4.

Furthermore, subdivision formulas (such as linear rolls, flams, or triplet licks) can be mapped to short or long notes. If a formula's internal strokes are complex (e.g. a six-stroke roll or sextuplet), attempting dynamic elastic warping across swung upbeat slots introduces fragile calculations and distortion.

## Decision

1. **Independent Reading Feel:** Introduce a dedicated `Reading Feel` mode (`straight` | `swing`) in the Reading Line / Dawson Orchestration domain, decoupled from the Metronome's `Pulse Feel`. In 4/4, the Metronome continues delivering its quarter-note beat grid while the Reading Line interprets eighth notes according to the chosen feel.
2. **Triplet Swing Offset (2:1):** In `swing` mode:
   - On-beat downbeats remain at whole beat offsets ($0.0, 1.0, 2.0, 3.0$).
   - Off-beat upbeats (written eighth notes on the "&") shift from $+0.5$ to $+2/3$ ($\approx 0.667, 1.667, 2.667, 3.667$), aligning precisely with the third triplet stroke of the `Jazz Swing` ride ostinato.
3. **Notation Preservation:** The visual notation in `ReadingScoreRenderer` remains standard 4/4 straight eighth notes (matching the Ted Reed book tradition). A `Swing (♫ = ♩♪)` badge/header is displayed visually when swing feel is active.
4. **Zero Elastic Distortion on Formulas:** Formulas maintain their static stroke duration ratios. When a note triggers, its formula's strokes start at the note's calculated onset time (downbeat or $+2/3$ upbeat) and sound with their nominal durations without artificial time compression or elastic warping.
5. **Formula Feel Classification:** `SubdivisionFormula` accepts an optional `feel?: 'straight' | 'swing' | 'neutral'` tag so jazz-specific triplet formulas or straight binary formulas are clearly classified without breaking existing presets.

## Consequences

- Drum practice over jazz swing ostinatos sounds musical and rhythmically coherent without altering the score notation.
- Single-line reading remains fully active in 4/4 regardless of swing selection.
- The audio engine remains simple and deterministic, avoiding complex time-stretching logic across bar boundaries.
