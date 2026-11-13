# Metronono

A smart rhythm trainer and metronome app combining Alan Dawson drumming interpretation systems, procedural rhythm generation, and advanced metronomic training.

## Language

**Reading Line**:
A single-voice rhythmic melody of notes and rests in 4/4 (inspired by Ted Reed's Syncopation) that serves as an abstract trigger for drum orchestration. Non-destructively suspended (silent, no Playhead) whenever the Metronome is not in 4/4.
_Avoid_: Drum chart, drum tab, score sheet

**Short Note**:
A note of shorter duration (typically an eighth note) in the reading line interpreted by a rapid drum voice such as the snare drum.
_Avoid_: Fast note, eighth

**Long Note**:
A note of longer duration (typically a quarter note or tied note) in the reading line interpreted by an anchoring drum voice such as the bass drum.
_Avoid_: Heavy note, quarter

**Ostinato**:
A persistent, repeating background rhythm layer (modeled as a 4/4 measure of orchestrated drum strokes) played simultaneously with the reading line orchestration, managed and selected independently from the interpretation system. Non-destructively suspended whenever the Metronome is not in 4/4.
_Avoid_: Groove, beat, loop

**Dawson System**:
A paired mapping of a Short Formula and a Long Formula that routes the short and long notes of a reading line onto drum kit voices, operating independently from the selected ostinato. Non-destructively suspended whenever the Metronome is not in 4/4.
_Avoid_: Drum preset, rhythm mapping

**Metronome**:
The precision audio clock and beat generator supporting arbitrary N/D time signatures with quarter-note = BPM, a selectable pulse feel (Straight = 2 eighth notes / quarter-note pulse, or Triplet = 3 eighth notes / dotted-quarter pulse) where fractional remainder beats wrap at the exact measure boundary, per-pulse muting, gap clicks, tempo ramps, and Dropout Mode.
_Avoid_: Click track, timer

**Dropout Mode**:
The Metronome's internal-clock training mode that silences full measures of the Metronome click — either via a deterministic cycle of Click Bars and Silent Bars (mutually exclusive with randomness), or via stochastic Silence Probability when both bar counts are zero — while notation, Ostinato, and Dawson Orchestration continue uninterrupted.
_Avoid_: Stochastic muting, random mute, click dropout

**Sample Bank**:
The `.wav` audio asset registry providing default bundled samples (`public/samples/<voiceId>.wav`) and user-configurable overrides for drum kit voices and metronome subdivisions, with zero synthesized fallback.
_Avoid_: Sound font, sound pack, synth fallback

**Lookahead Scheduler**:
The audio timing architecture that decouples a coarse JavaScript interval from the hardware-timed audio rendering thread to achieve sample-accurate beat delivery without jitter.
_Avoid_: JS timer, clock ticker

**Measure Plan**:
The pre-resolved schedule of one reading-line measure: its Scheduled Drum Events bucketed by beat, built when playback starts and rebuilt only when the composition changes. The clock tick reads the next bucket instead of consulting the domain.
_Avoid_: Tick resolution, on-the-beat resolve

**Audio Voice Pool**:
The pure Web Audio sample playback model: decoded `AudioBuffer` assets cached once per voice and triggered via lightweight `AudioBufferSourceNode` → per-hit `GainNode` chains into the target Mixing Channel, self-cleaning on `ended` with natural polyphony and zero live synth nodes.
_Avoid_: Live synth ring, Tone.js MetalSynth/MembraneSynth, shared per-voice GainNode, dangling gain node

**Subdivision Formula**:
The sequence of sub-beat strokes and rests (monophonic hits or stacked unisons like kick and cymbal) applied to a single short or long note trigger.
_Avoid_: Fill lick, sticking pattern, limb sequence

**Gap Clicks**:
The subdivision voice's clicks sounding at the even fractions between one pulse click and the next, splitting each pulse into a chosen number of equal parts (suppressed if they fall on or past a truncated measure boundary); one part means the pulse click alone and no gap clicks. Counted in parts, not added clicks: two parts is one click in the gap.
_Avoid_: Subdivision Formula (the drum-stroke formula this must not be confused with), upbeat, shuffle feel

**Reading View**:
A minimalist single-line rhythmic score displaying only short and long notes (with rests and ties) used for sight-reading and mental orchestration training. The sole notation view for reading training exercises.
_Avoid_: Tab view, practice sheet, drum staff view

**Orchestrated Stroke**:
An individual sounding hit or rest within an orchestration formula defining a specific figure duration, target drum voices (single hit or stacked unison), and articulation.
_Avoid_: Drum hit, note event, limb hit

**Mixing Channel**:
One of the three audibility lanes of the practice output — Click, Ostinato, or Orchestration — feeding the destination directly. Ostinato and Orchestration each have a single volume and mute; Click is shaped independently per voice (Downbeat, Regular, Subdivision) with no master click fader or mute. Silencing a lane or voice produces no sound, without stopping the Metronome or the notation.
_Avoid_: Track, bus, stem, fader, channel strip

**Audition**:
A single user-initiated playback of a Sample Bank sample or Subdivision Formula, independent of the transport and of Mixing Channel mutes.
_Avoid_: Preview, solo, test sound

**No Ostinato**:
A state in which no Ostinato layer is active or composed, producing no background drum strokes. Distinct from muting the Ostinato Mixing Channel, which keeps stroke resolution but suppresses audio output.
_Avoid_: Silenced ostinato, muted ostinato

**No Orchestration**:
A state in which no Dawson System is active, so reading line events trigger no drum orchestration strokes. Distinct from muting the Orchestration Mixing Channel, which evaluates formulas but suppresses audio output.
_Avoid_: Silenced system, muted system

### Interface

**Accent**:
The single warm-orange identity color shared by all interactive elements, active states, and the Playhead. One accent app-wide; there is no second decorative color.
_Avoid_: Teal, highlight color, secondary color

**Status Colors**:
The three semantic hues with fixed meaning — Success (valid), Warning (attention), Destructive (danger/invalid) — used only where that meaning genuinely holds. Difficulty tiers borrow them by hue.
_Avoid_: Decorative color, traffic light; a neutral label is never Warning

**Modal Scrim**:
The one dimmed ink overlay behind every modal dialog — a single dimming treatment shared by all modals.
_Avoid_: Backdrop, blackout, frosted panel

**Playhead**:
The Accent-colored marker showing the current sounding position in notation and formula views; every view renders the same Playhead.
_Avoid_: Cursor, scrubber, position line, play head (two words)

**Headroom**:
The vertical clearance a drum staff reserves above and below its stave, computed from the highest and lowest voice lines actually drawn plus named engraving clearances (stem reach, beam stack, tuplet bracket, accent) — the viewport grows to fit it, never clips notes.
_Avoid_: Fixed stave offset, magic 25, clipping margin

**Note-Anchored Interpolation**:
The metric mapping between beat offsets and pixels in a drum staff layout: piecewise-linear through each stroke's real notehead x and beat offset, bracketed by the note start and end — the playhead lands exactly on noteheads, and the inverse mapping round-trips.
_Avoid_: Linear drift, start-to-end guess

**Continuous Metric Timeline**:
The partiture canvas's representation of a measure as metric events at fractional time-in-measure offsets — the same offsets the audio scheduler uses — rather than a coerced homogeneous slot grid; mixed ratios (1/3 swing beside 1/4 straight) coexist without collision.
_Avoid_: Slot array, slot grid, fixed grid, quantized measure

**Quantization Adapter**:
The single place quantization is allowed: when an edit gesture *creates* a new event, its time is snapped to the current subdivision grid (16ths or triplets per selectedDuration); existing events keep their exact ratios.
_Avoid_: Re-quantizing on every edit, coercing the measure
