# Continuous Metric Timeline in the Partiture Formula Canvas

The partiture editors coerced every measure into a homogeneous slot grid (`strokesToSlots` with a fixed slotDuration of 16ths or 12ths). As soon as a measure mixes ratios that do not share that grid — 1/3-beat swing triplets beside 1/4-beat straight figures — strokes collide in the same slot (`round(offset/slotDuration)` overwrites silently) and geometry degrades: `getSlotGeometry` falls back to equal-width linear boxes whenever the rendered stroke count differs from the slot count, so click hitboxes, drag snap guides and the hover wash no longer match the noteheads VexFlow drew. The PartitureFormulaCanvas module was deepened to operate directly on continuous metric time offsets (`timeInMeasure`, the fractional beat offsets `resolveStrokeOffsets` already yields), the same numbers the audio scheduler uses to place events. Strokes remain polyphonic metric events end to end; the canvas reads and writes the editor's `OrchestratedStroke[]` directly (insert sorted by offset, merge unison hits at equal offsets). Quantization survives only as an adapter at the edit-gesture seam: a click or drag asks "which event is at this x" through the layout's note-anchored `getBeatOffsetForX` (ADR-0012's seam), and only a *new* event is snapped to the current grid (16ths or triplets, per selectedDuration). `strokesToSlots`/`slotsToStrokes` conversion churn is deleted from the canvas; the PartitureFormulaEditor's subdivision bar keeps its quantized strip as a display view over the same events (`getSlotLabels` stays for labels).

## Considered Options

- **Finer homogeneous grid (32nds + triplet-safe LCD)**: rejected — no common grid exists for arbitrary ratios (5:4 polyrhythms, swing 3:2 both break any fixed LCD), and the collision class of bugs merely moves to a rarer ratio.
- **Keep slots but key them by offset instead of index**: rejected — a keyed slot map is the continuous timeline with extra indirection; the offset itself is the identity, so the map buys nothing and keeps the rounding traps.
- **Quantize at load instead of at gestures**: rejected — re-quantizing on every round-trip mutates user figures (swing figures drift to the grid after one edit); the user's ratios must be preserved, only new events snapped.
- **Editor-side-only deepening, canvas keeps slots**: rejected — the canvas is where hitboxes, hover and drag geometry live; leaving it slot-based preserves the misalignment this candidate exists to delete.

## Consequences

- The canvas's public surface changes: slot-array helpers are deleted; gestures speak `OrchestratedStroke[]`. The PartitureFormulaEditor (its only consumer) is updated in the same slice so the pair lands compiling.
- Pins that assert slot indices/labels are re-pinned honestly against the adapter (the editor's subdivision bar is display, not representation); behavior pins (stamp on voice line, erase, unison stacking, drag between positions) stay green unchanged.
- Mixed figures become representable end to end: a jazz-swing measure (1/3s) edited beside a straight 16th figure no longer collides; the PENDING item about playhead/hitbox alignment is served because both derive from the same anchor list (ADR-0012).
- Editor state round-trips exactly: what the canvas commits equals what the audio scheduler schedules (same stroke list, same offsets).
