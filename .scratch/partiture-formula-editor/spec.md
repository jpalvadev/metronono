# Spec: Partiture (Drum Staff) Editor for Formula Composer

Status: ready-for-agent

## Problem Statement

When drummers configure Alan Dawson orchestration systems in Metronono, they articulate Short Notes (8th notes or shorter) and Long Notes (quarter notes or longer) using custom Subdivision Formulas. However, composing or modifying a formula currently forces the user through an abstract, disjointed form of isolated cards and dropdown menus. To add or alter a stroke, the user must select a "Drum Voice" from a text dropdown (e.g. "Snare", "Kick", "Floor Tom"), pick a "Duration Ratio" from a button array, pick a dynamic articulation, and choose an explicit limb assignment (`R`, `L`, `RF`, `LF`).

This interface is disconnected from how drummers read and write music:
1. It does not look like sheet music: there is no score or stave representation, making it impossible to visualize the rhythmic contour or see how the phrase lines up across beats.
2. It forbids multi-surface unisons: a formula is forced into a strictly linear sequence of single hits. A drummer cannot notate standard phrasing such as a Bass Drum and Crash Cymbal hit struck together on an accented downbeat.
3. It has no notation for silence: rests cannot be entered, preventing syncopated figures or gapped subdivisions.
4. It imposes pointless cognitive overhead with explicit limb assignments (`R`, `L`, `RF`, `LF`), which have zero audible effect on playback and clutter the editing workflow.
5. Entering and editing notes requires endless dropdown hunting instead of standard notation interaction (picking a note value and placing or dragging it onto a drum staff).

## Solution

The form-based dialog is replaced with an interactive **Drum Staff View (Partiture Editor)** for Subdivision Formulas. Composing a formula becomes an intuitive, sheet-music-first experience modeled on the standard 5-line Percussive Arts Society (PAS) percussion stave:

1. **5-Line Percussion Stave**: Sound sources (drum voices) are placed directly onto standard pitch positions on the stave (Snare on the 3rd space C5, Kick on the 1st space F4, Ride and Hi-Hat on or above the top line with cross noteheads, Toms across lines and spaces).
2. **Direct Notation Interaction & Drag-and-Drop**: A top palette offers active note values (Quarter, 8th, 16th, 32nd, Triplets), note vs. rest toggles, and dynamic articulations (Accent `>`, Ghost `( )`, Flam, Drag, Normal). Users can drag note tokens from the palette directly onto the staff lines, click-to-stamp at any beat position, or drag existing notes vertically to change drum voice or horizontally to adjust metric timing. An Eraser tool allows removing individual notes or converting beats to rests.
3. **Polyphonic Stacking & Dual-Voice Engraving**: Users can stack multiple drum voices at the exact same time offset (e.g. Kick + Crash unison). The notation renderer automatically splits stacked notes into PAS Voice 1 (Hands, stems up) and Voice 2 (Feet, stems down), with metric beat-grouped beaming.
4. **Explicit Rests**: Rests can be placed anywhere in the formula, correctly advancing the metric clock while remaining silent during playback.
5. **Retirement of the Limb Concept**: Limb assignments (`R`, `L`, `RF`, `LF`) are completely removed from the formula data model, domain engine, and UI, eliminating friction.
6. **Tactile Audition & Duration Budget**: Dropping or dragging a note triggers instant one-shot audio feedback for that drum voice. An audition button sweeps an animated playhead across the stave in sync with audio playback, while a duration budget bar clearly shows how much of the formula's trigger duration has been filled.

## User Stories

1. As a drummer, I want to edit subdivision formulas on an interactive 5-line percussion staff, so that I can read and write formulas in standard drum notation instead of dropdown menus.
2. As a drummer, I want vertical placement on the stave to determine the drum voice (e.g. 3rd space for snare, 1st space for kick, top space for crash), so that choosing a sound source matches standard music notation.
3. As a drummer, I want to stack multiple drum voices at the exact same beat offset (such as a bass drum and a crash cymbal together), so that I can notate accented unisons.
4. As a drummer, I want stacked hands and feet to automatically split into stems-up (hands) and stems-down (feet), so that polyphonic drum notation is legible and follows PAS conventions.
5. As a drummer, I want to place explicit rests within a formula, so that I can write syncopated figures with silent subdivisions.
6. As a drummer, I want to select a note value from the toolbar (Quarter, 8th, 16th, 16th Triplet, 32nd) before placing a note, so that I can easily enter the desired duration.
7. As a drummer, I want to choose dynamic articulations (Accent `>`, Ghost `( )`, Flam, Normal) for any note on the staff, so that my phrasing has expressive dynamics.
8. As a drummer, I want to drag note tokens from the toolbar palette directly onto the staff lines, so that I can compose via intuitive drag-and-drop.
9. As a drummer, I want to click or tap directly on the staff to place a note using the active palette tool, so that rapid note entry is supported on touch screens and desktop alike.
10. As a drummer, I want to click and drag an existing note vertically to transpose it to another drum voice (e.g. drag snare to high tom), so that I can re-voice a phrase without deleting and re-entering notes.
11. As a drummer, I want to drag an existing note horizontally to shift its metric placement, so that I can adjust rhythmic timing quickly.
12. As a drummer, I want horizontal dragging and clicking to snap to an adaptive subdivision grid (straight or triplet), so that notes align cleanly with sub-beats.
13. As a drummer, I want an Eraser tool (or drag-off-staff gesture) to remove notes from the stave, so that mistakes can be undone easily.
14. As a drummer, I want erasing all notes at a given beat offset to convert that time slice into an equivalent rest, so that the measure's total duration remains intact.
15. As a drummer, I want to not be asked for limb assignments (`R`, `L`, `RF`, `LF`), so that my composition workflow is not bogged down by meaningless sticking metadata.
16. As a drummer, I want placing or dragging a note on the staff to immediately play a one-shot sample of that drum sound, so that I get immediate audible confirmation of what I placed.
17. As a drummer, I want an "Audition Formula" button that plays the entire formula at the current tempo, so that I can hear the phrase in rhythm before saving it.
18. As a drummer, I want an animated playhead line to sweep across the staff during audition playback, so that I can visually track the notation as it sounds.
19. As a drummer, I want a visual duration budget indicator (e.g. `0.75 / 1.0 beats filled`), so that I know whether my formula matches the Short Note or Long Note trigger length.
20. As a drummer, I want rapid subdivisions (8ths, 16ths, 32nds) to be automatically beamed by metric beat, so that the notation looks clean and professional.
21. As a drummer, I want to name my custom formula and give it an optional description, so that I can find it later in the preset list.
22. As a drummer, I want the formula editor dialog to open with ample screen width on both mobile and desktop, so that the staff and tools never feel cramped.
23. As a student, I want built-in formulas to sound identical in the Dawson engine with stacked unisons and clean rhythms, so that the default practice experience is preserved.
24. As a contributor, I want a clean, chord-based domain model (`OrchestratedStroke` with `hits: Array<{ voice, dynamic }>`), so that multi-voice events are represented without hacky parallel arrays.
25. As a contributor, I want automated component tests for the partiture editor using the existing fake Tone and testing-library setup, so that regressions in note placement or auditioning are caught immediately.

## Implementation Decisions

### 1. Unified 5-Line PAS Percussion Staff Renderer

- The editor leverages VexFlow percussion engraving using the 5-line PAS standard pitch map from `DrumStaffRenderer`:
  - `snare`: C5 (space 3)
  - `snare_ghost`: C5 (space 3, ghost/bracketed notehead)
  - `kick`: F4 (space 1)
  - `tom_high`: E5 (line 4)
  - `tom_mid`: D5 (line 3)
  - `tom_floor`: A4 (space 2)
  - `hihat_closed`: G5 (above line 5, cross notehead)
  - `hihat_open`: G5 (above line 5, cross notehead with circle)
  - `hihat_foot`: D4 (below line 1, cross notehead)
  - `ride`: F5 (line 5, cross notehead)
  - `ride_bell`: F5 (line 5, diamond notehead)
  - `crash`: A5 (above line 5, cross notehead)
- Stave coordinate mapping provides two essential spatial functions:
  - `getDrumVoiceForY(y: number): DrumVoice | null`: converts a vertical coordinate to the nearest drum voice line/space.
  - `getStepForX(x: number, gridResolution: number): number | null`: converts a horizontal coordinate to the nearest snapped metric step.

### 2. Chord-Based Formula Domain Model & Limb Retirement (ADR-0006)

- The `Limb` type (`'R' | 'L' | 'RF' | 'LF'`) and all related properties are deleted from domain types (`types.ts`), the Dawson engine (`DawsonEngine.ts`), preset managers, and components.
- An `OrchestratedStroke` is generalized to represent a metric time slice that is either a rest or a chord of simultaneous drum hits:

```typescript
export interface DrumHit {
  voice: DrumVoice;
  dynamic: Dynamic; // 'accent' | 'normal' | 'ghost' | 'flam' | 'drag'
}

export interface OrchestratedStroke {
  durationRatio: number; // in beats (e.g. 0.25 = 16th, 0.5 = 8th, 1/3 = triplet)
  isRest?: boolean;
  hits: DrumHit[]; // empty if isRest is true; multiple hits for unisons (e.g. kick + crash)
}

export interface SubdivisionFormula {
  id: string;
  name: string;
  trigger: 'short' | 'long';
  description?: string;
  strokes: OrchestratedStroke[];
  isCustom?: boolean;
}
```

- When `DawsonEngine.resolveOrchestrationEvents()` schedules a formula:
  - For each stroke, if `stroke.isRest === true`, it advances the offset by `durationRatio` without creating events.
  - If sounding, it creates a `ScheduledDrumEvent` for each hit in `stroke.hits` sharing the exact same `timeInMeasure`.
  - All default formulas (`DEFAULT_SHORT_FORMULAS`, `DEFAULT_LONG_FORMULAS`) are updated directly to this schema.

### 3. Dual-Voice Engraving & Metric Beaming

- The editor formats stave notes into two VexFlow voices:
  - **Voice 1 (Hands)**: All cymbal, snare, and tom hits with `Stem.UP`.
  - **Voice 2 (Feet)**: Kick drum and hi-hat foot hits with `Stem.DOWN`.
  - Staggered rests are merged or assigned to the primary voice when both hands and feet are silent.
- Beams are automatically generated per voice (`Beam.generateBeams`) grouped by metric quarter-note beats, maintaining `stemDirection: Stem.UP` for Voice 1 and `stemDirection: Stem.DOWN` for Voice 2.

### 4. Interactive Palette & Direct Staff Manipulation

- The editor dialog features a top command bar:
  - **Duration Selector**: 1/4 (1.0), 1/8 (0.5), 1/8 Triplet (0.333), 1/16 (0.25), 1/16 Triplet (0.1667), 1/32 (0.125).
  - **Type Selector**: Note vs. Rest.
  - **Articulation Selector**: Normal, Accent (`>`), Ghost (`( )`), Flam, Drag.
  - **Eraser Tool**: When active, clicking any notehead removes that specific voice from the chord. If all voices at that offset are removed, the slice converts to a rest.
- **Direct Canvas Interaction**:
  - Dragging a palette token over the canvas highlights the target line/space and target snap column. Releasing drops the note.
  - Clicking/tapping on the staff stamps the active note/rest at the clicked position. If a note already exists at that time offset on a different line, it appends to the chord (stacking the hit).
  - Clicking and dragging an existing note vertically recalculates its drum voice in real time.
  - Clicking and dragging horizontally shifts its beat offset according to the active snap grid.
- **Audition Feedback**:
  - Dropping or dragging onto any voice line invokes `player.triggerVoice(voice, 0, velocity, 'orchestration')`.
  - "Audition Formula" schedules the formula through `resolveStrokeOffsets()` and animates a vertical playhead across the stave matching the note coordinates.

### 5. Duration Budget Tracking

- A visual progress bar at the top of the canvas compares `totalDuration = calculateFormulaDuration(strokes)` against the target trigger duration (e.g. 0.5 beats for Short Note, 1.0 beat for Long Note).
- The indicator provides visual cues: normal (matching target), under-budget (amber indicator with remaining duration), and over-budget (warning badge with overflow duration).

## Testing Decisions

### What Makes a Good Test
- Tests must interact exclusively through public component props and standard DOM/user events (clicks, pointer drag events, button presses).
- No testing of internal React state, private methods, or VexFlow internals.
- Verify user-observable outcomes:
  - Correct noteheads and stave elements are rendered into the SVG container.
  - Dropping/stamping notes invokes `player.triggerVoice()` with the expected voice and velocity.
  - Saving the dialog invokes `onSave` with the properly structured polyphonic `SubdivisionFormula` object (with rests, chords, and without limbs).
  - Erasing notes updates the chord or creates a rest.
  - Audition triggers all stacked voices at the same beat offset simultaneously.

### Modules Tested
1. **`FormulaEditorDialog` (or `PartitureFormulaEditorDialog`)**: Primary integration test seam covering palette selection, staff stamping/dragging, chord stacking, rest creation, audio auditioning, and saving.
2. **`DawsonEngine`**: Unit tests verifying that polyphonic chord formulas produce simultaneous `ScheduledDrumEvent`s at identical offsets and correctly skip rests.
3. **`SubdivisionFormula`**: Math and offset calculation tests verifying duration summation and offset resolution for chords and rests.

### Prior Art
- `src/components/dawson/__tests__/FormulaEditorDialog.test.tsx`: Existing dialog test harness using mock `IDrumKitPlayer`.
- `src/notation/__tests__/DrumStaffRenderer.test.ts`: Coordinate lookup and VexFlow percussion stave assertions.
- `src/domain/dawson/__tests__/DawsonEngine.test.ts`: Orchestration event scheduling tests.

## Out of Scope

- Multi-measure drum chart transcription (the editor is strictly focused on 1- to 2-beat subdivision formulas for short/long note triggers).
- Complex multi-stave orchestral notation (e.g. timpani, mallets).
- Manual tie curve dragging or arbitrary microtonal pitch bending.
- Persistent cloud synchronization (handled independently by the storage subsystem).

## Further Notes

- Relates to Item 10 in `PENDING.md`.
- Implements architectural decisions recorded in `docs/adr/0006-polyphonic-partiture-formulas-and-limb-removal.md`.
- Aligns with canonical terminology defined in `GLOSSARY.md` (specifically **Drum Staff View**, **Subdivision Formula**, and **Orchestrated Stroke**).
