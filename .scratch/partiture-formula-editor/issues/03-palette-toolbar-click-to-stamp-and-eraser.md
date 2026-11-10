# 03: Palette toolbar, click-to-stamp, and eraser

**What to build:** A note-entry palette toolbar and interactive stave stamping system. Drummers can select duration values, toggles for notes vs. rests, dynamic articulations, or an eraser tool, then click or tap directly on the percussion stave to stamp notes at that position. If a note already exists at that beat offset on another drum line, stamping appends to the chord to create unisons. Erasing a note removes that specific voice from the chord, and erasing all voices at an offset converts the slice into a rest. Each stamped note plays an immediate one-shot sample.

**Blocked by:** 02 (Dual-voice drum staff renderer for formulas)

**Status:** resolved

- [x] A toolbar palette provides selection for note durations: Quarter (1/4), Eighth (1/8), Eighth Triplet (1/8 T), Sixteenth (1/16), Sixteenth Triplet (1/16 T), and Thirty-Second (1/32).
- [x] The toolbar provides a toggle between Note and Rest modes, an Articulation selector (Normal, Accent `>`, Ghost `( )`, Flam, Drag), and an Eraser tool.
- [x] Clicking or tapping on the stave in Note mode stamps the active note duration and articulation onto the drum voice corresponding to the clicked staff line.
- [x] If a note already exists at that metric step on a different drum line, stamping adds the new voice to the chord without displacing the existing note.
- [x] Clicking or tapping in Rest mode creates a rest of the active duration at that metric step.
- [x] Clicking with the Eraser tool removes the clicked drum voice from that chord; if no voices remain at that offset, the step becomes an equivalent rest.
- [x] Stamping a note on any line immediately sounds that drum voice through the audio player with the chosen dynamic.
- [x] Automated component tests verify palette selection, chord stamping, rest placement, eraser conversion, and one-shot audio dispatch.

## Answer

Implemented `FormulaPaletteToolbar`, `PartitureFormulaCanvas`, and `PartitureFormulaEditor`:
1. Palette toolbar offers note durations (1/4, 1/8, 1/8 T, 1/16, 1/16 T, 1/32), Note/Rest/Eraser tool toggles, and dynamic articulations (Normal, Accent, Ghost, Flam, Drag).
2. Canvas click-to-stamp maps pointer coordinates to PAS drum voice lines and snapped beat offsets.
3. Multiple clicks at the same metric offset append to the stroke's chord, producing polyphonic unisons without overwriting existing voices.
4. Rest mode places explicit rests of the active duration.
5. Eraser tool removes targeted voices from chords, converting to explicit rests when no hits remain.
6. Immediate one-shot sample playback with dynamic velocity triggers on every note stamp.
7. Automated component tests pass in `FormulaPaletteToolbar.test.tsx`, `PartitureFormulaCanvas.test.tsx`, and `PartitureFormulaEditor.test.tsx`.
