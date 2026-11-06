# 03: Procedural Rhythmic Generator & Ted Reed Classical Library

**What to build:** A pure domain combinatorial engine that generates infinite, musically coherent syncopated rhythms based on Ted Reed's formal 1-beat and 2-beat rhythmic cells in 4/4 time, alongside a pre-loaded library of standardized textbook exercises (Syncopation pages 33 to 38). Users can select difficulty levels to progressively practice different syncopation patterns without unplayable or chaotic note clusters.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Domain models for ReadingLine, Measure, Note, Rest, and Tie are formally defined in pure TypeScript
- [ ] Catalog of Ted Reed 1-beat and 2-beat rhythmic cells categorized into 3 difficulty tiers (Level 1: quarters and on-beat eighths; Level 2: off-beat eighth syncopations; Level 3: cross-bar ties and complex syncopations)
- [ ] Procedural generator produces valid 4/4 measures totaling exactly 4.0 beats per measure with no floating-point rounding errors
- [ ] Seedable or continuous random mode generates endless new phrases without repeating identical measures consecutively
- [ ] Library loader provides pre-configured standard exercises matching Ted Reed's Syncopation (Lessons 1-12 / Pages 33-38)
- [ ] 100% deterministic test coverage verifying metric sum invariants and cell categorization across thousands of generated measures
