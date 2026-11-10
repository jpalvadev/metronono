# 04: Drag-and-drop placement and note transposition

**What to build:** Full drag-and-drop support for composing and editing formulas on the drum staff. Drummers can drag note tokens from the palette toolbar directly onto staff lines to insert them, drag existing notes vertically to transpose them to another drum voice in real time, and drag notes horizontally to shift their metric timing along an adaptive snap grid. Immediate audio feedback sounds while dragging across drum voices.

**Blocked by:** 03 (Palette toolbar, click-to-stamp, and eraser)

**Status:** ready-for-agent

- [ ] Users can drag a note token from the palette and drop it onto the stave, inserting the note at the targeted drum line and snapped metric column.
- [ ] Dragging an existing notehead vertically updates its drum voice in real time (e.g. dragging a snare note down to the floor tom or kick line), triggering the new drum sound on line crossing.
- [ ] Dragging an existing note horizontally shifts its metric start offset, snapping to subdivisions defined by the active grid resolution (straight vs. triplet).
- [ ] Dragging an existing note completely off the stave removes that voice from the chord (equivalent to erasing).
- [ ] Visual drop target highlights indicate the active staff line and horizontal snap guide while dragging.
- [ ] Automated tests simulate drag-and-drop gestures, verifying vertical transposition, horizontal metric shifting, and drag-off removal.
