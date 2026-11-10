# 02: Dual-voice drum staff renderer for formulas

**What to build:** An interactive 5-line PAS drum staff renderer tailored for subdivision formulas. Given an array of polyphonic formula strokes (chords and rests), the renderer engrave a professional percussion stave: sound sources (drum voices) are placed on standard pitch lines and spaces, stacked notes are automatically partitioned into standard dual voices (hands stems up, feet stems down), metric beats are cleanly beamed, and coordinate lookup helpers translate canvas positions to drum voices and snapped beat steps.

**Blocked by:** 01 (Polyphonic formula domain model and limb removal)

**Status:** resolved

- [x] Formula strokes are engraved on a 5-line percussion stave following the standard PAS pitch map (Snare on space 3, Kick on space 1, Toms on lines and spaces, Cymbals with cross noteheads on or above line 5).
- [x] Multi-voice unisons at the same metric offset automatically separate into Voice 1 (Hands: cymbals, snare, toms) with stems pointing up, and Voice 2 (Feet: bass drum, hi-hat foot) with stems pointing down.
- [x] Explicit rests render on the stave using standard musical rest symbols matching the stroke's duration.
- [x] Beaming groups rapid subdivisions (8ths, 16ths, 32nds) by metric quarter-note beats separately for Voice 1 and Voice 2.
- [x] A spatial helper `getDrumVoiceForY(y: number)` accurately translates any vertical pointer/canvas position to the nearest drum voice line or space.
- [x] A spatial helper `getStepForX(x: number, gridResolution: number)` accurately translates any horizontal pointer/canvas position to the nearest snapped subdivision column.
- [x] Automated rendering tests assert correct SVG element creation, dual-voice stem directions, and coordinate lookup accuracy.

## Answer

Implemented `DrumStaffFormulaRenderer`:
1. Renders a dedicated 5-line PAS percussion stave with percussion clef.
2. Automatically partitions formula hits into Voice 1 (Hands, Stem.UP) and Voice 2 (Feet, Stem.DOWN).
3. Explicit rests render with standard rest notation matching stroke durations.
4. Automatic beaming for rapid subdivisions across both voices.
5. Spatial helpers `getDrumVoiceForY(y)` and `getStepForX(x, gridResolution)` accurately map canvas coordinates to drum lines and snapped subdivision columns.
6. Comprehensive test suite in `src/notation/__tests__/DrumStaffFormulaRenderer.test.ts` passes.
