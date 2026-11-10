# 03: Palette toolbar, click-to-stamp, and eraser

**What to build:** A note-entry palette toolbar and interactive stave stamping system. Drummers can select duration values, toggles for notes vs. rests, dynamic articulations, or an eraser tool, then click or tap directly on the percussion stave to stamp notes at that position. If a note already exists at that beat offset on another drum line, stamping appends to the chord to create unisons. Erasing a note removes that specific voice from the chord, and erasing all voices at an offset converts the slice into a rest. Each stamped note plays an immediate one-shot sample.

**Blocked by:** 02 (Dual-voice drum staff renderer for formulas)

**Status:** ready-for-agent

- [ ] A toolbar palette provides selection for note durations: Quarter (1/4), Eighth (1/8), Eighth Triplet (1/8 T), Sixteenth (1/16), Sixteenth Triplet (1/16 T), and Thirty-Second (1/32).
- [ ] The toolbar provides a toggle between Note and Rest modes, an Articulation selector (Normal, Accent `>`, Ghost `( )`, Flam, Drag), and an Eraser tool.
- [ ] Clicking or tapping on the stave in Note mode stamps the active note duration and articulation onto the drum voice corresponding to the clicked staff line.
- [ ] If a note already exists at that metric step on a different drum line, stamping adds the new voice to the chord without displacing the existing note.
- [ ] Clicking or tapping in Rest mode creates a rest of the active duration at that metric step.
- [ ] Clicking with the Eraser tool removes the clicked drum voice from that chord; if no voices remain at that offset, the step becomes an equivalent rest.
- [ ] Stamping a note on any line immediately sounds that drum voice through the audio player with the chosen dynamic.
- [ ] Automated component tests verify palette selection, chord stamping, rest placement, eraser conversion, and one-shot audio dispatch.
