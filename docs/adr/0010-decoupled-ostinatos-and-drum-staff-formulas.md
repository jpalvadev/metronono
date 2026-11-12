# Decoupled Ostinatos, First-Class 4/4 Drum Staff Patterns, and Independent Dropdown Architecture

## Context
Previously, Alan Dawson orchestration tightly coupled interpretation systems to ostinatos (each `DawsonSystem` held a fixed `ostinatoId`), ostinatos were hardcoded constants with no CRUD or notation rendering, and the UI displayed a rigid grid of preset system cards. Furthermore, musicians practicing the Alan Dawson method need orthogonal control over the background ostinato layer and the reading line interpretation, including the ability to compose custom ostinatos and formulas on standard 5-line drum staves, as well as silencing either layer.

## Decision
1. **Complete Decoupling**: Ostinatos and Interpretation Systems are fully orthogonal. Selecting an interpretation system modifies only Short and Long formula mappings, leaving the active ostinato untouched.
2. **First-Class 4/4 Ostinato Patterns**: Ostinatos are promoted from static strings to first-class domain entities (`OstinatoPattern`) containing a 4/4 measure (4 beats) of polyphonic `OrchestratedStroke[]`. They are rendered on 5-line drum staves, persist in `DawsonPresetManager` with CRUD support, and can be edited via the modal drum staff editor.
3. **Streamlined Two-Column Dropdown UI**:
   - Header: Houses the title and a top-right `Manage Systems, Formulas & Ostinatos` button.
   - Left Column: Ostinato dropdown (with "Ninguno" silence option) + 5-line drum staff viewer + Audition and Edit buttons.
   - Right Column: Interpretation System dropdown (with "Ninguno" silence option) + two 5-line drum staff viewers (Short Formula and Long Formula) + Audition and Edit buttons.
4. **Minimal Factory Baseline**:
   - Ostinatos: "Jazz Swing" (Ride + hi-hat foot on 2 and 4) and "Corcheas en Hi-Hat" (closed hi-hat straight eighths).
   - Interpretation Systems: "Snare & Kick" (short: snare, long: kick) and "Hi-Hat Foot & Kick" (short: hi-hat foot / pedal, long: kick).
   - All factory presets are immutable; editing creates a user-customized duplicate.
5. **Silence States**: Selecting "Ninguno" renders a full 4/4 measure of rests with a subtle "Silencio" badge and suppresses audio event scheduling for that layer.
