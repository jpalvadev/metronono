# 01: Canvas speaks continuous events — gestures commit strokes, not slots

**What to build:** PartitureFormulaCanvas operates directly on metric events at fractional timeInMeasure offsets (from resolveStrokeOffsets). Every gesture handler (click stamp, eraser, rest, palette drop, pointer drag) reads the layout's note-anchored continuous time (getBeatOffsetForX), finds the nearest existing event by time distance, and commits OrchestratedStroke[] directly (sorted by offset, hits at equal offsets merged into one chord). The Quantization Adapter (snap a *new* event's time to a multiple of selectedDuration) lives only here. Hover wash, header labels and drag guide geometry come from event anchors (neighbor midpoints of strokeCoordinates), never against a slot count. strokesToSlots/slotsToStrokes/getSlotGeometry/getSlotIndexForX exports are deleted from the canvas module; getSlotLabels stays (display labels). The editor's slot-step buttons still work because the canvas keeps honoring the editor props (no export the editor needs removed in this slice except the slot-array pair — coordinate with 02).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Click-stamp, unison stacking, rest mode, eraser, palette-drop and drag-between-position suites stay green (behavior pins unchanged).
- [ ] New RED: a measure with a 1/3-beat stroke beside a 0.25-beat stroke round-trips through a click edit with both events present, no collision, no count drift.
- [ ] New RED: a click at an x between two events commits into the nearest event by *time* (note-anchored), not slot rounding.
- [ ] Slot-array exports (strokesToSlots, slotsToStrokes) no longer exist in the canvas module (tsc fails any consumer trying them).
- [ ] Hover/drag geometry derives from event anchors: the hover wash for a triplet measure aligns with the rendered notehead anchors.
