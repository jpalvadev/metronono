# 04: Single-Line Reading View with Real-time Playhead (VexFlow 5)

**What to build:** High-resolution musical engraving of the single-line Reading View (Ted Reed style) rendered in the browser via VexFlow 5 and the Bravura music font. As the metronome plays, a vertical playhead cursor advances smoothly across the notation in real-time, matching the current measure and beat so the musician's eyes remain locked onto the reading exercise.

**Blocked by:** 01 (Project Foundation & Audio Click Metronome), 03 (Procedural Rhythmic Generator & Ted Reed Classical Library)

**Status:** resolved

- [x] VexFlow 5 integration with `@vexflow-fonts/bravura` renders crisp SVG sheet music on single-line percussion staves
- [x] Rhythmic notation supports quarter notes, eighth notes, tied notes, and quarter/eighth rests with standard stem directions
- [x] Responsive layout adapts the number of measures per stave to fit desktop and mobile screens cleanly
- [x] Animated vertical playhead cursor traverses the score synchronized to `Tone.Transport`'s audio position
- [x] Seamless loop and paging: as playback progresses, the score pages or scrolls forward to display upcoming measures
- [x] Component tests verify score rendering and playhead offset synchronization with the audio clock
