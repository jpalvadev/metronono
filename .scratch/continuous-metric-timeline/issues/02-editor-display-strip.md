# 02: Editor slot bar becomes a quantized display strip over the events

**What to build:** PartitureFormulaEditor's subdivision bar keeps the familiar slot-step buttons, but they are now a Quantization Adapter over the continuous events: button s maps to time s*slotDuration; toggling finds the event at that time (within half a slot) or creates one snapped to that time, and commits OrchestratedStroke[] directly (the canvas's commit semantics). The editor no longer imports strokesToSlots/slotsToStrokes (they were deleted from the canvas in 01); getSlotLabels stays for the strip's labels.

**Blocked by:** 01 (Canvas speaks continuous events).

**Status:** ready-for-agent

- [ ] PartitureFormulaEditor.test.tsx stays green (slot-step toggle behavior: adds/removes a hit at the step's position, commits strokes).
- [ ] The editor compiles without the deleted slot-array exports (tsc green in the same commit as the change).
- [ ] A mixed-ratio figure (1/3 + 0.25 strokes) shown in the editor: step buttons still snap to grid times; the existing fractional events stay addressable by the canvas gestures (verified by the canvas suite, not duplicated here).
