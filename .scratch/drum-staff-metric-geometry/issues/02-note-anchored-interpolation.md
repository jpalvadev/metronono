# 02: Note-Anchored Interpolation — the metric seam follows the render

**What to build:** getXForBeatOffset and getBeatOffsetForX become the piecewise-linear inverses through the real anchors: each stroke's beat offset paired with its notehead's absolute x, bracketed by (0, noteStartX) and (targetBeats, noteEndX). The audition Playhead in the canvas and every editor snap now sit exactly on the noteheads, including inside triplets where VexFlow's proportional justification breaks the old linear guess.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] For a measure with an 8th-triplet group, getXForBeatOffset(stroke.beatOffset) equals that stroke's strokeCoordinates x at every anchor (identity contract, floating tolerance).
- [ ] Between anchors the mapping is strictly increasing and piecewise-linear; outside [0, targetBeats] it clamps as today.
- [ ] getBeatOffsetForX is the mirrored inverse: round-trip at anchors (getBeatOffsetForX(anchorX) == anchorOffset), and its old endpoints (noteStart -> 0, noteEnd -> targetBeats) hold.
- [ ] getStepForX routes through the same anchor mapping (editor snapping agrees with the Playhead), keeping gridResolution endpoints.
- [ ] Existing 'calculates playhead and beat offsets accurately' test stays green (ordering assertions unchanged).
