# 04: Drag-and-drop placement and note transposition

**What to build:** Full drag-and-drop support for composing and editing formulas on the drum staff. Drummers can drag note tokens from the palette toolbar directly onto staff lines to insert them, drag existing notes vertically to transpose them to another drum voice in real time, and drag notes horizontally to shift their metric timing along an adaptive snap grid. Immediate audio feedback sounds while dragging across drum voices.

**Blocked by:** 03 (Palette toolbar, click-to-stamp, and eraser)

**Status:** resolved

- [x] Users can drag a note token from the palette and drop it onto the stave, inserting the note at the targeted drum line and snapped metric column.
- [x] Dragging an existing notehead vertically updates its drum voice in real time (e.g. dragging a snare note down to the floor tom or kick line), triggering the new drum sound on line crossing.
- [x] Dragging an existing note horizontally shifts its metric start offset, snapping to subdivisions defined by the active grid resolution (straight vs. triplet).
- [x] Dragging an existing note completely off the stave removes that voice from the chord (equivalent to erasing).
- [x] Visual drop target highlights indicate the active staff line and horizontal snap guide while dragging.
- [x] Automated tests simulate drag-and-drop gestures, verifying vertical transposition, horizontal metric shifting, and drag-off removal.

## Answer

Implemented full drag-and-drop and note transposition gestures:
1. Palette tokens are draggable (`draggable={true}`) and handle drop onto the stave, inserting notes at the targeted line and column.
2. Vertical dragging on canvas transposes drum voices with real-time audio playback when crossing voice lines.
3. Horizontal dragging snaps metric start offsets along the active subdivision grid.
4. Dragging off the stave removes that voice from the chord or converts single-note slices into rests.
5. Interactive drop-target and snap guide overlays render in real time during drag gestures.
6. Comprehensive test suite in `PartitureFormulaCanvasDrag.test.tsx` passes.
