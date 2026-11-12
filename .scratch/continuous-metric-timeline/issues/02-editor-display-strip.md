# 02: Editor slot bar becomes a quantized display strip over the events

**What to build:** PartitureFormulaEditor's subdivision bar keeps the familiar slot-step buttons, but they are now a Quantization Adapter over the continuous events: button s maps to time s*slotDuration; toggling finds the event at that time (within half a slot) or creates one snapped to that time, and commits OrchestratedStroke[] directly (the canvas's commit semantics). The editor no longer imports strokesToSlots/slotsToStrokes (they were deleted from the canvas in 01); getSlotLabels stays for the strip's labels.

**Blocked by:** 01 (Canvas speaks continuous events).

**Status:** done

- [x] PartitureFormulaEditor.test.tsx stays green (slot-step toggle behavior: adds/removes a hit at the step's position, commits strokes).
- [x] The editor imports eventsFromStrokes/commitEvents/getEventIndexForTime instead of the deleted slot pair; tsc green in the same commit as the canvas deletion (module pair).
- [x] Mixed-ratio figure through a step toggle: durations [1/3, 1/3, 0.25, 0.083 pad] — fractional ratios preserved (old grid would have re-quantized to [1/3, 1/3, 1/3]).
