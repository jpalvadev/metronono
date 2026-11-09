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
The sequence of sub-beat strokes and limb assignments (e.g. Foot-Left-Right triplet) applied to a single short or long note trigger.
_Avoid_: Fill lick, sticking pattern

**Reading View**:
A minimalist single-line rhythmic score displaying only short and long notes (with rests and ties) used for sight-reading and mental orchestration training.
_Avoid_: Tab view, practice sheet

**Drum Staff View**:
A standard 5-line percussion score (PAS standard) with dedicated pitch positions and notehead shapes (crosses for cymbals, ovals for drums) used for writing and inspecting full kit orchestrations.
_Avoid_: Full tab, multi-track sheet

**Orchestrated Stroke**:
An individual hit within an orchestration formula defining specific figure duration, target drum voice, limb, and articulation.
_Avoid_: Drum hit, note event

**Mixing Channel**:
One of the three audibility lanes of the practice output — Click, Ostinato, or Orchestration — each with its own volume and mute under a single Master. A muted channel produces no sound and no drum-pad illumination, without stopping the Metronome or the notation.
_Avoid_: Track, bus, stem, fader, channel strip

**Practice Preset**:
A one-press combination of Mixing Channel mutes naming a practice configuration: Click Only, Drums Only, or Full Mix; Custom when the channels match none of them.
_Avoid_: Mode, scene, template

**Audition**:
A single user-initiated playback of a Sample Bank sample or Subdivision Formula, independent of the transport and of Mixing Channel mutes.
_Avoid_: Preview, solo, test sound

**No Ostinato**:
A Dawson System configuration in which no Ostinato layer is composed at all, so no ostinato strokes are ever resolved. Distinct from muting the Ostinato Mixing Channel, which keeps the strokes and silences only their sound.
_Avoid_: Silenced ostinato, muted ostinato
