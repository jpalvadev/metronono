# 03: Procedural Rhythmic Generator & Ted Reed Classical Library

**What to build:** A pure domain combinatorial engine that generates infinite, musically coherent syncopated rhythms based on Ted Reed's formal 1-beat and 2-beat rhythmic cells in 4/4 time, alongside a pre-loaded library of standardized textbook exercises (Syncopation pages 33 to 38). Users can select difficulty levels to progressively practice different syncopation patterns without unplayable or chaotic note clusters.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Domain models for ReadingLine, Measure, Note, Rest, and Tie are formally defined in pure TypeScript
- [x] Catalog of Ted Reed 1-beat and 2-beat rhythmic cells categorized into 3 difficulty tiers (Level 1: quarters and on-beat eighths; Level 2: off-beat eighth syncopations; Level 3: cross-bar ties and complex syncopations)
- [x] Procedural generator produces valid 4/4 measures totaling exactly 4.0 beats per measure with no floating-point rounding errors
- [x] Seedable or continuous random mode generates endless new phrases without repeating identical measures consecutively
- [x] Library loader provides pre-configured standard exercises matching Ted Reed's Syncopation (Lessons 1-12 / Pages 33-38)
- [x] 100% deterministic test coverage verifying metric sum invariants and cell categorization across thousands of generated measures

## Comments

### Resolution Summary
- Implemented pure TypeScript domain models in `src/domain/rhythm/types.ts` (`ReadingLine`, `Measure`, `RhythmicEvent`, `RhythmicCell`, `CellEventTemplate`) with exact integer sixteenth-pulse math guaranteeing 4.0 beats per 4/4 measure without floating-point rounding errors, and classification helpers for short (<= 0.5 beat) vs long (>= 1.0 beat or tied from previous) notes.
- Defined Ted Reed rhythmic cell catalog in `src/domain/rhythm/ReedCellCatalog.ts` featuring 1-beat and 2-beat cells categorized across 3 progressive difficulty tiers (Tier 1: on-beat anchors; Tier 2: intra-measure syncopations and off-beats; Tier 3: cross-beat/bar ties).
- Built deterministic, seedable PRNG procedural generator in `src/domain/rhythm/ProceduralGenerator.ts` capable of generating infinite stream of measures, non-repeating consecutive measures, and pairing cross-bar ties across measure boundaries.
- Transcribed classic Ted Reed exercises in `src/domain/rhythm/ReedLibrary.ts` covering Pages 33-36 (Sets 1-4, 48 modular exercises) and Pages 37-38 benchmark 32-measure solo etudes ("Exercise One" and "Exercise Two").
- Verified with 28 unit tests across 3 test suites (`ReedCellCatalog.test.ts`, `ProceduralGenerator.test.ts`, `ReedLibrary.test.ts`), all passing deterministically, with clean `npm run build` production bundling.
