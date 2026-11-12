# Spec: Continuous Metric Timeline Seam in the Partiture Editors

**Status:** ready-for-agent

## Problem Statement

The partiture formula canvas coerces every measure into a homogeneous slot grid (`strokesToSlots` at a fixed slotDuration). The moment a measure mixes ratios that do not share that grid — 1/3-beat swing triplets beside 1/4-beat straight figures — strokes collide in the same slot (rounding overwrites silently) and the geometry degrades: slot hitboxes, hover washes and drag guides fall back to equal-width linear boxes that no longer match the noteheads actually rendered. Drummers editing swing or polyrhythmic figures lose notes and see the hover/drag affordances point at the wrong places.

## Solution

Deepen the PartitureFormulaCanvas module to operate directly on the **Continuous Metric Timeline**: polyphonic events at fractional `timeInMeasure` offsets — the same offsets `resolveStrokeOffsets` already computes and the audio scheduler already uses. The canvas reads and writes the editor's `OrchestratedStroke[]` directly (insert sorted by offset, merge unison hits at equal offsets); `strokesToSlots`/`slotsToStrokes` conversion churn is deleted from the canvas. Quantization survives only as a **Quantization Adapter** at the edit-gesture seam: hit-testing reads continuous time through the layout's note-anchored `getBeatOffsetForX` (ADR-0012's seam), and only a *newly created* event is snapped to the current subdivision grid (selectedDuration: 16ths or triplets). Event hitboxes are derived from the layout's note anchors (neighbor midpoints of `strokeCoordinates`), so hitboxes, hover and the Playhead agree with the render. The PartitureFormulaEditor's subdivision bar keeps a quantized strip, but as display over the same events (`getSlotLabels` stays for labels).

## User Stories

1. As a drummer, I want to edit a measure that mixes swing triplets and straight 16ths, so that neither figure silently overwrites the other.
2. As a drummer, I want a click on the stave to stamp a voice at the nearest metric position of the *rendered* notes, so that what I click is what is drawn.
3. As a drummer, I want dragging a voice between positions to move it to another metric position without re-quantizing the whole measure, so that swing ratios survive edits.
4. As a drummer, I want the hover column and drag guide to align with rendered noteheads even in mixed figures, so that the visual affordances never point at empty space between notes.
5. As a drummer, I want erasing a hit from a chord to work at any fractional offset, so that unison stacks at 1/3-beat positions erase like any other.
6. As a returning user, I want the strokes I commit in the editor to equal what the audio scheduler schedules, so that what I see matches what I hear.
7. As a returning user, I want new notes to snap to the subdivision I selected (16ths or triplets), so that creation stays easy even though representation is continuous.
8. As a drummer reading the subdivision strip under the canvas, I want the label strip to keep showing beat labels, so that the familiar UI stays (display, not representation).
9. As a returning user, I want the canvas and editor to land as one compiling pair, so that no intermediate state breaks consumers.

## Implementation Decisions

- Continuous event identity = its beat offset (timeInMeasure). Events are `OrchestratedStroke` with offsets from `resolveStrokeOffsets`; the canvas's commit path sorts strokes by offset and merges strokes at equal offsets into unison chords.
- Gesture hit-testing: continuous `x -> timeInMeasure` via the layout's note-anchored `getBeatOffsetForX` (ADR-0012), then nearest existing event by time distance; if none (or tool creates), the **Quantization Adapter** snaps the time to a multiple of selectedDuration within [0, targetBeats).
- Event geometry (hover wash, header labels, drag snap) = neighbor-anchor midpoints over `layout.strokeCoordinates` themselves (never against a slot count); this replaces `getSlotGeometry`'s slot-count fallback, deleting the distortion path.
- Delete `strokesToSlots`/`slotsToStrokes` exports from the canvas; the editor's slot-step bar is rebuilt as a quantized *display* strip over the events (labels via `getSlotLabels`; a step interaction = the adapter snapping to that step's time then delegating to the same event commit).
- Voice-line hit-testing (Y) is unchanged: `getDrumVoiceForY` + nearest PAS line (existing behavior pins stay green).
- Editor and canvas are one module pair: the slice that deletes the canvas exports updates the editor consumer in the same commit (compilation boundary).
- What must not change: behavior pins — stamp on clicked voice line, unison stacking at same offset, erase voice, rest creation, drag between positions, palette drop. Playhead rendering already lands on anchors (ADR-0012) and stays.

## Testing Decisions

- Seam (pre-agreed, existing): the three component suites — `PartitureFormulaCanvas.test.tsx` (jsdom + testing-library), `PartitureFormulaCanvasDrag.test.tsx`, `PartitureFormulaEditor.test.tsx`. They pin observable behavior (DOM + committed stroke arrays), which is the right level: the deepening must keep them green or re-pin honestly where the adapter redefines the interaction.
- New RED pins to add: mixed-ratio measure (1/3 + 0.25 strokes) round-trips through the canvas without collision or count drift; click at an x between two events commits at the nearest anchor time (not slot-rounded); a drag from one event to another moves exactly that voice; the editor's step buttons still snap to grid times.
- Prior art: existing canvas/drag/editor suites (render/fireEvent patterns, mock `IDrumKitPlayer`), `resolveStrokeOffsets` facts from `SubdivisionFormula.test.ts`.
- Full `npm run check` gate on each ticket commit (pre-commit hook).

## Out of Scope

- The modal FormulaEditorDialog (separate editor surface; only follows if it imports the deleted exports — verify and adapt if so).
- The audio side (already continuous: the engine schedules from the same stroke list).
- Multi-measure paging, tap-tempo, mixer gestures.
- VexFlow layout internals (ADR-0012 owns the mapping; this candidate consumes it).

## Further Notes

- ADR-0013 records the decisions; glossary adds Continuous Metric Timeline and Quantization Adapter.
- The canvas already renders via the deepened layout (ADR-0012); this candidate makes its *input* continuous so both visual and audio agree at arbitrary ratios.
