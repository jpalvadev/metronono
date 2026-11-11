# Metronono

A smart rhythm trainer and metronome app combining Alan Dawson drumming interpretation systems, procedural rhythm generation, and advanced metronomic training.

## Language

**Reading Line**:
A single-voice rhythmic melody of notes and rests (inspired by Ted Reed's Syncopation) that serves as an abstract trigger for drum orchestration.
_Avoid_: Drum chart, drum tab, score sheet

**Short Note**:
A note of shorter duration (typically an eighth note) in the reading line interpreted by a rapid drum voice such as the snare drum.
_Avoid_: Fast note, eighth

**Long Note**:
A note of longer duration (typically a quarter note or tied note) in the reading line interpreted by an anchoring drum voice such as the bass drum.
_Avoid_: Heavy note, quarter

**Ostinato**:
A persistent, repeating background rhythm (such as a jazz ride pattern with hi-hat on 2 and 4) played simultaneously with the reading line orchestration.
_Avoid_: Groove, beat, loop

**Dawson System**:
A deterministic rule set that maps short and long notes of a reading line onto drum kit voices over an ostinato.
_Avoid_: Drum preset, rhythm mapping

**Metronome**:
The precision audio clock and beat generator supporting variable accents, gap clicks, tempo ramps, and stochastic muting.
_Avoid_: Click track, timer

**Sample Bank**:
The audio asset registry providing user-configurable samples for drum kit voices and metronome subdivisions.
_Avoid_: Sound font, sound pack

**Lookahead Scheduler**:
The audio timing architecture that decouples a coarse JavaScript interval from the hardware-timed audio rendering thread to achieve sample-accurate beat delivery without jitter.
_Avoid_: JS timer, clock ticker

**Subdivision Formula**:
The sequence of sub-beat strokes and rests (monophonic hits or stacked unisons like kick and cymbal) applied to a single short or long note trigger.
_Avoid_: Fill lick, sticking pattern, limb sequence

**Gap Clicks**:
The subdivision voice's clicks sounding at the even fractions between one beat click and the next, splitting each beat into a chosen number of equal parts; one part means the beat click alone and no gap clicks. Counted in parts, not added clicks: two parts is one click in the gap.
_Avoid_: Subdivision Formula (the drum-stroke formula this must not be confused with), upbeat, shuffle feel

**Reading View**:
A minimalist single-line rhythmic score displaying only short and long notes (with rests and ties) used for sight-reading and mental orchestration training. The sole notation view for reading training exercises.
_Avoid_: Tab view, practice sheet, drum staff view

**Orchestrated Stroke**:
An individual sounding hit or rest within an orchestration formula defining a specific figure duration, target drum voices (single hit or stacked unison), and articulation.
_Avoid_: Drum hit, note event, limb hit

**Mixing Channel**:
One of the three audibility lanes of the practice output — Click, Ostinato, or Orchestration — each with its own volume and mute feeding the destination directly. A muted channel produces no sound, without stopping the Metronome or the notation.
_Avoid_: Track, bus, stem, fader, channel strip

**Audition**:
A single user-initiated playback of a Sample Bank sample or Subdivision Formula, independent of the transport and of Mixing Channel mutes.
_Avoid_: Preview, solo, test sound

**No Ostinato**:
A Dawson System configuration in which no Ostinato layer is composed at all, so no ostinato strokes are ever resolved. Distinct from muting the Ostinato Mixing Channel, which keeps the strokes and silences only their sound.
_Avoid_: Silenced ostinato, muted ostinato

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
