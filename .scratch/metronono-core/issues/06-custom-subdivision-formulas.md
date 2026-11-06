# 06: Custom Subdivision Formulas & Multi-Limb Orchestration Editor

**What to build:** An interactive editor enabling drummers to define and customize their own multi-limb orchestration formulas for short and long notes (such as Foot-Left-Right triplets for short notes, or linear paradiddle-diddle phrases like F-L-R-L-RR for long notes). Each individual stroke in a formula declares its own specific duration/figure, target drum voice (Snare, Kick, High Tom, Mid Tom, Floor Tom, Cymbals), physical limb, and dynamic articulation (accent, normal, ghost note, flam). The Dawson engine plays these custom formulas seamlessly in real time.

**Blocked by:** 05 (Alan Dawson Orchestration Engine & Drum Sample Playback)

**Status:** resolved

- [x] Formula Editor dialog allows creating, naming, editing, and deleting custom SubdivisionFormulas
- [x] Formula builder supports adding individual strokes with custom duration ratios (e.g. 1/8 note, 1/16 note, 1/8 triplet, etc.)
- [x] Stroke inspector assigns target voice (Snare, Kick, Tom 1, Tom 2, Floor Tom, Ride, Hi-Hat, Crash) and limb (R, L, RF, LF)
- [x] Articulation selector toggles dynamic levels: Accent (velocity ~115), Normal (~85), Ghost Note (~40), and Flam
- [x] Dawson engine correctly maps custom short and long formulas onto any active ReadingLine
- [x] System Preset Manager allows saving combinations of formulas + ostinatos as custom named Dawson Systems
- [x] Tests verify formula timing math (fractional duration sums) and multi-limb event scheduling
