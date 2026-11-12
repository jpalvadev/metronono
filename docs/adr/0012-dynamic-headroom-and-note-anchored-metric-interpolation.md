# Dynamic Headroom and Note-Anchored Metric Interpolation in the Drum Staff Renderer

Drum staff margins clipped high cymbal stems and tuplet brackets (a hardcoded staveY of 25 pushed crash figures and tuplet [3] brackets above y=0 in a 160px viewport), and the coordinate mapping produced severe visual drift: `getXForBeatOffset` interpolated linearly from `getNoteStartX()` to `getNoteEndX()` while VexFlow's formatter justifies notes proportionally with its own spacing rules, so the audition playhead in the partiture canvas never lands on triplet noteheads. The DrumStaffFormulaRenderer was deepened to own both. Vertical margins are computed from content: the highest and lowest drum-voice lines actually used (from DRUM_VOICE_PAS_MAP — crash sits at line -1.0, hi-hat foot at 4.5) plus engraving clearances held as module-level named consts (stem reach, beam stack, tuplet bracket and number clearance, accent clearance). The returned height grows past the requested `options.height` when content demands it — grow, never clip. The metric seam now exposes exact note-anchored interpolation: `getXForBeatOffset` and `getBeatOffsetForX` are piecewise-linear inverses through the real anchors — each stroke's beat offset paired with its notehead's absolute x — bracketed by the note start and end x. The public interface does not move (same layout fields), so the canvas and viewer consumers stay untouched; what deepened is what the layout knows.

## Considered Options

- **Bigger fixed viewport (status quo's static fix)**: rejected — a fixed staveY that always clears a crash tuplet wastes vertical space on kick-only figures and still guesses at beam stacks.
- **Post-draw SVG bounding-box scan to size the margin**: rejected — jsdom does not implement getBBox, and geometry computed from the domain before drawing is stable and testable; a post-hoc scan is neither observable in tests nor deterministic across fonts.
- **Re-justify notes ourselves to beat-proportional spacing**: rejected — VexFlow's formatter is the rendering ground truth; fighting it would desync what the user sees from what the canvas overlays.
- **Interpolation anchored on beat gridlines instead of noteheads**: rejected — gridlines are not rendered; the user-visible target (the playhead over a notehead) demands notehead anchors.

## Consequences

- Extends the notation rules in CODING_STANDARDS.md (engraving geometry as module-level consts that tests import); this ADR names which consts exist: stem reach, beam stack, tuplet clearance, accent clearance.
- `layout.height` may exceed the requested height; consumers pass `height` as a minimum (DrumStaffViewer sizes its container with minHeight, the canvas playhead is X-only) — no caller may assume height equals its request.
- Anchoring interpolation makes the canvas hitboxes (also built from `strokeCoordinates`) and the playhead agree exactly at every stroke — the PENDING item about playhead sizing against the rendered block is served by this seam.
- `getStepForX` keeps its grid semantics but should share the anchor mapping so editor snapping and the playhead stay consistent.
