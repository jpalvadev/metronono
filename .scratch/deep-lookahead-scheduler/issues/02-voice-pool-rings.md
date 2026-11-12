# 02: Voice Pool — drum rigs cycle synth rings per stroke

**What to build:** Consecutive rapid strokes on one voice (hi-hat 16ths at fast tempo, crash figures) each get a live synth instance, so no attack cancels the previous one. The Audio Voice Pool is internal: each drum rig voice slot holds a small ring of same-kind synths (two; three for the long-decay cymbal MetalSynths) cycled per stroke, built once with the eager graph.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Two strokes in a row on the same rig voice trigger two distinct synth nodes (observed via the fake Tone trigger records).
- [ ] No new audio node is created per stroke: node-kind counts stay stable across many fired beats.
- [ ] Voice slots keep their exact timbres (a ride stroke still triggers a MetalSynth of the ride slot; existing routing-to-Mixing-Channel assertions hold).
- [ ] The eager graph wiring suite (single kick stroke routing, 6 destination inputs, dispose disconnects all) stays green with ring-labeled slots.
- [ ] dispose() of the player disposes every ring member.
