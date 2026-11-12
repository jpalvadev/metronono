# 01: Canvas speaks continuous events — gestures commit strokes, not slots

**What to build:** PartitureFormulaCanvas operates directly on metric events at fractional timeInMeasure offsets (from resolveStrokeOffsets). Every gesture handler (click stamp, eraser, rest, palette drop, pointer drag) reads the layout's note-anchored continuous time (getBeatOffsetForX), finds the nearest existing event by time distance, and commits OrchestratedStroke[] directly (sorted by offset, hits at equal offsets merged into one chord). The Quantization Adapter (snap a *new* event's time to a multiple of selectedDuration) lives only here. Hover wash, header labels and drag guide geometry come from event anchors (neighbor midpoints of strokeCoordinates), never against a slot count. strokesToSlots/slotsToStrokes/getSlotGeometry/getSlotIndexForX exports are deleted from the canvas module; getSlotLabels stays (display labels). The editor's slot-step buttons still work because the canvas keeps honoring the editor props (no export the editor needs removed in this slice except the slot-array pair — coordinate with 02).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Click-stamp, unison stacking, rest mode, eraser, palette-drop and drag-between-position suites stay green (behavior pins unchanged).
- [x] Mixed 1/3 + 0.25 figure round-trips through a click edit: durations [1/3, 1/3, 0.25] preserved, chord merged at the fractional event, no slot collision.
- [x] A click at an x between events commits into the nearest event by *time* (continuous getBeatOffsetForX, half-grid tolerance), not slot rounding.
- [x] strokesToSlots/slotsToStrokes/getSlotGeometry/getSlotIndexForX no longer exist (editor rebuilt in the same commit, tsc green).
- [x] Hover wash and drag guides derive from the rendered note anchors (getEventGeometry over strokeCoordinates).
