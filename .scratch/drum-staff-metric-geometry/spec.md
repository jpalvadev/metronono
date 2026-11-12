# Spec: Drum Staff Headroom & Note-Anchored Metric Geometry

**Status:** ready-for-agent

## Problem Statement

A drummer reading a crash figure with a triplet bracket on a drum staff sees the tuplet [3] and the cymbal stems sliced off at the top of the SVG (a hardcoded stave offset of 25 in a 160px viewport leaves no headroom). Separately, in the partiture formula canvas the audition Playhead and the drag snap-guides drift far from the notes they should sit on: the layout maps beat offsets to pixels linearly from note start to note end, while VexFlow justifies notes proportionally with its own spacing rules — worst on triplets, where the drift is severe.

## Solution

Deepen the DrumStaffFormulaRenderer at its layout seam. Vertical margins become content-dependent **Headroom**: computed from the highest and lowest drum-voice lines actually drawn (via DRUM_VOICE_PAS_MAP — crash at line -1.0, hi-hat foot at 4.5) plus engraving clearances held as module-level named consts (stem reach, beam stack, tuplet bracket clearance, accent clearance). The layout height grows past the requested height when content demands it — grow, never clip. The metric seam becomes **Note-Anchored Interpolation**: `getXForBeatOffset` and `getBeatOffsetForX` are piecewise-linear inverses through the real anchors — each stroke's beat offset paired with its notehead's absolute x — bracketed by the stave's note start and end. The public interface does not move: same layout fields, untouched consumers (DrumStaffViewer, PartitureFormulaCanvas).

## User Stories

1. As a drummer, I want a crash note and its tuplet bracket fully visible on the drum staff, so that practicing swing figures with cymbal accents never shows sliced-off notation.
2. As a drummer, I want kick and hi-hat-foot figures fully visible below the stave, so that low voices with accent marks are never cut at the bottom edge.
3. As a drummer, I want the SVG viewport to grow when a figure needs more room, so that "requested height" is a minimum, not a clip.
4. As a drummer, I want a simple quarter-note line to keep the compact staff height it already enjoys, so that headroom is earned from content, not wasted on every staff.
5. As a returning user, I want the same engraving clearances every render (stem reach, beam stack, tuplet bracket), so that the margins never jitter between renders.
6. As a drummer watching the partiture canvas, I want the Playhead to sit exactly over the current stroke's notehead, so that the visual and the audio say the same position.
7. As a drummer watching triplets, I want the Playhead to follow VexFlow's actual justification (the 1/3, 2/3, 1 beat noteheads), not a linear guess, so that the severe triplet drift disappears.
8. As a drummer dragging a stroke in the editor, I want the beat offset read back from an x to agree with the note anchored there, so that snapping and the drag guide stay consistent with the render.
9. As a returning user, I want the layout interface unchanged (strokeCoordinates, getDrumVoiceForY, getStepForX, getBeatOffsetForX, getXForBeatOffset), so that no consumer needs to know the deepening happened.
10. As a returning user, I want stroke hitboxes (built from strokeCoordinates) and the Playhead to agree exactly at every stroke, so that the canvas and the score never disagree.

## Implementation Decisions

- Deepening internal to the renderer; no interface moves, no new exports beyond module-level geometry consts (CODING_STANDARDS hard rule: engraving geometry as module-level named consts, tests import them).
- Named consts: stem reach, beam stack height, tuplet bracket+number clearance, accent clearance, voice note half-height. Headroom = f(highest line used by the rendered strokes) from the top stave line upward; Footroom = f(lowest line used) below the bottom line.
- staveY becomes the computed headroom; rendered height = max(requested height, headroom + stave height + footroom). Callers treat height as a minimum (DrumStaffViewer's minHeight container, canvas playhead X-only).
- Note-Anchored Interpolation: anchors from strokeCoordinates (beatOffset, x = note.getAbsoluteX()) sorted by beat offset, bracketed by (0, getNoteStartX()) and (targetBeats, getNoteEndX()); piecewise-linear between anchors; both directions (getXForBeatOffset forward, getBeatOffsetForX mirrored inverse); outside [0, targetBeats] clamped as today.
- Contract identity: getXForBeatOffset at each stroke's beatOffset returns exactly that stroke's anchor x (within floating tolerance), and getBeatOffsetForX(getXForBeatOffset(o)) round-trips at anchors.
- getStepForX keeps grid semantics but must route through the same anchor mapping so editor snapping agrees with the Playhead.
- What must not change: 5-line percussion stave, percussion clef, voice1Notes-only rule, beams/tuplets drawing, consumers' code.

## Testing Decisions

- Seam (pre-agreed, existing): `src/notation/__tests__/DrumStaffFormulaRenderer.test.ts` — jsdom + real VexFlow; assertions on the rendered SVG DOM plus the layout object per CODING_STANDARDS § Notation renderers (pin geometry/relationships, import the consts, never re-type literals).
- Good tests assert external behavior: stave y position and SVG viewport height equal the computed Headroom math; every drawn element sits inside the viewport (no clipping) expressed as geometry relationships from the consts; `getXForBeatOffset(stroke.beatOffset) == stroke.x` at every anchor of a triplet measure; monotone strictly increasing between anchors; inverse round-trip; consumers unaffected (viewer/canvas suites stay green).
- Prior art: `ReadingScoreRenderer.test.ts` (SVG DOM assertions), existing `DrumStaffFormulaRenderer.test.ts` (jsdom renderer usage), `DrumVoicePAS.test.ts` (map facts).

## Out of Scope

- Replacing VexFlow's formatter or re-justifying notes ourselves (the layout seam must follow the render, not fight it).
- Horizontal clef/barline margins beyond padding, multi-measure formula paging, the reading-score renderer.
- Playhead overlay sizing in the canvas (PENDING item 11 stays as background; this candidate fixes the X mapping the playhead uses, not the overlay box).

## Further Notes

- ADR-0012 (Dynamic Headroom and Note-Anchored Metric Interpolation) records the decisions; glossary adds Headroom and Note-Anchored Interpolation.
- Candidate 3 (continuous metric timeline) will replace the discrete stroke array upstream; keep this seam anchor-based so it composes with continuous events.
