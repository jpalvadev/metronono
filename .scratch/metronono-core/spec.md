# Spec: Metronono Core

Status: ready-for-agent

## Problem Statement

Drummers and percussionists studying independence, coordination, and rhythmic reading (specifically using the Alan Dawson method applied to Ted Reed's *Progressive Steps to Syncopation* and George Lawrence Stone's *Stick Control*) face a high cognitive barrier when attempting to practice alone. 

Translating an abstract single-line rhythmic melody into drum set orchestrations (e.g., short notes to snare drum, long notes to bass drum, over a continuous jazz ride cymbal and hi-hat on 2 and 4, or executing rudimental formulas like F-L-R triplets or linear diddles) requires mental translation while maintaining strict tempo. 

Existing metronome apps only provide basic clicks, lack musical interpretation engines, and cannot procedurally generate new reading lines or display standard drum notation alongside abstract reading lines. Furthermore, typical web audio metronomes suffer from timing jitter or lose user data on browser cache clear, while mobile practice requires background playback and offline local file storage.

## Solution

Metronono is an offline-capable, cross-platform rhythmic trainer and smart metronome built as a high-performance Web PWA packaged with Capacitor for native Android deployment and running in desktop web browsers.

It features:
1. **Dual-View Notation**: A clean 1-line **Reading View** displaying abstract short/long notes for sight-reading training, paired with a full 5-line **Drum Staff View** (PAS standard) showing the fully voiced drum set score with cymbal crosses and drum heights.
2. **Alan Dawson Orchestration Engine**: Deterministic mapping of short and long notes across multiple drum voices over configurable ostinatos (Bop swing, inverted rock, Latin, etc.), supporting customizable multi-limb **Subdivision Formulas** (e.g. F-L-R, linear diddles) with explicit durations, limb assignments, and dynamics.
3. **Smart Metronome & Audio Scheduler**: Sample-accurate, jitter-free playback powered by Tone.js (`Tone.Transport` and `Tone.Players`), featuring custom subdivision accents (e.g., beats 1, 2, 4), tempo automation ramps, and stochastic "Dropout" mode (silencing random bars to test internal timekeeping).
4. **Intelligent Procedural Generator**: A combinatorial rhythmic generator built upon Ted Reed's formal 1-beat and 2-beat rhythmic cells categorized by complexity levels (avoiding impossible or unmusical phrases).
5. **Dual-Layer Persistent Storage**: File System Access API on desktop for saving/loading directly to a real local folder on disk, native file system access on Android via Capacitor, and persistent IndexedDB caching to prevent data loss on browser cache clears.

## User Stories

1. As a drummer, I want to open the app and start a rock-solid metronome immediately, so that I can practice with precise timing.
2. As a drummer, I want to configure the metronome to only click on specific beats (such as 2 and 4, or 1 and 4), so that I can develop my own internal pulse.
3. As a drummer, I want to activate a "Dropout Mode" with a configurable mute probability (e.g., 25% or 50% of measures silenced), so that I can test whether my tempo rushes or drags when the click disappears.
4. As a student of the Alan Dawson method, I want to see a single-line Reading View with notes and rests, so that I can practice reading rhythms without seeing the full drum chart.
5. As a student of the Alan Dawson method, I want to hear a jazz ride ostinato (spang-a-lang) with hi-hat on beats 2 and 4 playing simultaneously with the reading line, so that I can practice coordination against a steady swing groove.
6. As a drummer, I want the Dawson engine to automatically play short notes (eighth notes) on the snare drum and long notes (quarter notes or tied notes) on the bass drum, so that I can hear how the classic Dawson Bop system sounds.
7. As an advanced drummer, I want to switch to an "Inverted Dawson System" where short notes trigger the bass drum and long notes trigger the snare drum, so that I can practice contrary motion.
8. As a drummer, I want to define custom Subdivision Formulas for short and long notes (e.g., Foot-Left-Right triplet for short notes, and F-L-R-L-RR linear diddles for long notes), so that I can practice complex rudimental vocabulary on the drum kit.
9. As a drummer, I want each stroke in a formula to have an explicit target voice (Snare, Kick, High Tom, Mid Tom, Floor Tom, Hi-Hat, Ride, Crash), so that I am not limited to single-drum surfaces.
10. As a drummer, I want each stroke in a formula to support dynamic articulations (Accent, Normal, Ghost Note, Flam, Drag), so that the orchestrated playback sounds musical and expressive.
11. As a drummer who reads sheet music, I want to switch to a 5-line Drum Staff View (PAS standard), so that I can view the fully orchestrated score with standard noteheads (crosses for cymbals, standard heads for drums) and stem directions.
12. As a composer/drummer, I want to write and edit drum patterns directly on the 5-line drum staff, so that I can transcribe exercises and hear them instantly.
13. As a student practicing sight-reading, I want an "Infinite Procedural Generator" that generates new, valid 4/4 syncopated measures continuously, so that I never run out of reading material and cannot rely on muscle memory.
14. As a student, I want to choose the complexity level of the procedural generator (Level 1: basic quarters and eighths; Level 2: simple syncopations/off-beats; Level 3: cross-bar ties and complex syncopations), so that I can practice at my exact skill level.
15. As a student, I want to access a library of classic exercises (such as Ted Reed's Syncopation pages 33 to 44), so that I can practice standardized textbook routines.
16. As a drummer, I want a visual playhead/cursor that advances beat-by-beat across the score in sync with the audio, so that my eyes stay locked to the current position in the measure.
17. As a drummer, I want independent volume mixers for Metronome Click, Ostinato, and Orchestrated Line, so that I can mute the app's drum sounds and play the exercises myself over just the click and ostinato.
18. As a drummer, I want to upload my own custom WAV/MP3 samples for each drum voice (Kick, Snare, Ghost Snare, Toms, Ride, Hi-Hat, Crash) and metronome click sounds (Downbeat, Upbeat, Subdivision), so that the kit sounds how I like.
19. As a desktop user, I want to link the app to a folder on my hard drive via the File System Access API, so that all my custom scores, audio samples, and presets are saved directly to disk.
20. As a mobile user, I want to install the app as an Android APK, so that my custom sounds and scores are saved to the device's storage and never deleted by browser cache maintenance.
21. As an Android user, I want the audio and metronome to continue playing uninterrupted when my screen locks or when I switch apps, so that I can practice without having to keep the screen permanently on.
22. As a drummer, I want a 1-click "Export Library" button that produces a `.metronono` (or `.zip`) archive, so that I have a portable backup of all my data.
23. As a drummer, I want an "Import Library" button, so that I can restore my complete setup on a new device.

## Implementation Decisions

### 1. Architectural Seams & Modules
- **Domain Core (Pure TypeScript)**:
  - `MetronomeEngine`: Pure logic generating tick events, dropout gating, and tempo interpolation curves.
  - `ProceduralGenerator`: Grammar-based combinatorial engine combining Ted Reed 1-beat and 2-beat rhythmic cells into 4/4 measures.
  - `DawsonEngine`: Resolver that takes a `ReadingLine` (short/long notes, rests, ties) and maps each note to a `SubdivisionFormula` over a background `Ostinato`, producing a flat chronological stream of `ScheduledDrumEvents`.
- **Audio Engine (Tone.js wrapper)**:
  - `ToneTransportScheduler`: Interfaces with `Tone.Transport` and `Tone.Players` to load audio buffers, schedule events with sub-millisecond precision on the hardware clock, and control master/channel gain nodes.
- **Notation Engine (VexFlow 5)**:
  - `ScoreRenderer`: Modular SVG renderer powered by VexFlow 5 and the Bravura SMuFL font, capable of rendering:
    - *Reading View*: Single-line percussion stave with rhythmic noteheads, ties, and rests.
    - *Drum Staff View*: 5-line percussion stave with standard PAS drum positions, cross noteheads for cymbals/hi-hats, and independent stem directions.
- **Storage Subsystem**:
  - `StorageAdapter`: Unified interface (`saveScore`, `loadScores`, `saveSample`, `loadSamples`, `exportArchive`, `importArchive`) backed by:
    - `FileSystemAccessAdapter` on Chromium desktop.
    - `CapacitorFilesystemAdapter` on Android.
    - `IndexedDBAdapter` for zero-config web caching.
- **UI Shell**:
  - React + Tailwind CSS + shadcn/ui.
  - Controls: BPM slider / Tap Tempo, Time Signature, Dropout Toggle, Ostinato Selector, View Mode Tabs (Reading vs Drum Staff), Volume Mixer dialog, Sample Bank CRUD modal.

### 2. Data Models (Type Shapes)

```typescript
export type Limb = 'R' | 'L' | 'RF' | 'LF';

export type DrumVoice = 
  | 'kick' 
  | 'snare' 
  | 'snare_ghost' 
  | 'tom_high' 
  | 'tom_mid' 
  | 'tom_floor' 
  | 'hihat_closed' 
  | 'hihat_open' 
  | 'hihat_foot' 
  | 'ride' 
  | 'ride_bell' 
  | 'crash';

export type Dynamic = 'accent' | 'normal' | 'ghost' | 'flam' | 'drag';

export interface OrchestratedStroke {
  durationRatio: number; // Duration in quarter note fraction (e.g. 0.333 for triplet eighth, 0.5 for eighth)
  voice: DrumVoice;
  limb?: Limb;
  dynamic: Dynamic;
}

export interface SubdivisionFormula {
  id: string;
  name: string;
  trigger: 'short' | 'long';
  strokes: OrchestratedStroke[];
}

export interface DawsonSystem {
  id: string;
  name: string;
  shortFormula: SubdivisionFormula;
  longFormula: SubdivisionFormula;
  ostinatoId: string;
}

export interface ScheduledDrumEvent {
  timeInMeasure: number; // 0 to 4 in 4/4 time
  voice: DrumVoice;
  velocity: number; // 0.0 to 1.0
  dynamic: Dynamic;
}
```

## Testing Decisions

### Seam Discipline
- **Highest Seam 1 (Domain Core Logic)**: All generator, grammar, and Dawson mapping logic will be tested through the public methods of `ProceduralGenerator` and `DawsonEngine`. Tests are 100% deterministic, run in pure TypeScript with zero DOM/Audio mocks, and verify that note durations, metric sums (exact 4/4 measures), and stroke offsets are mathematically sample-accurate.
- **Highest Seam 2 (Audio Scheduler)**: Tested via a `MockAudioTransport` verifying that events queued by the engines are scheduled at the exact timestamps without dropped frames.
- **Highest Seam 3 (Storage Persistence)**: Tested via an `InMemoryStorageAdapter` verifying full serialization round-trips for custom sample configurations and `.metronono` export/import archives.

## Out of Scope

- Machine learning or neural network audio source separation (Demucs, RoFormer, etc.) - completely excluded.
- Live microphone acoustic drum beat tracking / audio transcription.
- Social sharing / cloud user accounts (the app is strictly local-first and privacy-respecting).
- Tablature notation (the app strictly uses standard music engraving).

## Further Notes

- The project uses Vite, React, TypeScript, Tailwind CSS, shadcn/ui (preset `b5dMVCPy4`: style `lyra`, theme `teal`, base `mauve`, font `Montserrat`), Tone.js, VexFlow 5, and Capacitor.
- Architecture respects ADRs 0001 (Web PWA over Native Android), 0002 (Dual-Layer Storage Strategy), 0003 (Dual Notation Views), and 0004 (Audio, Notation, and UI Stack).
