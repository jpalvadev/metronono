# 02: Advanced Metronome Training: Variable Accents, Tempo Ramps & Dropout Mode

**What to build:** Advanced metronome training tools that allow drummers to strengthen their internal pulse and rhythm stability. The user can toggle which beats in a measure sound (such as clicking only on beats 2 and 4, or 1 and 4), program gradual tempo ramps (acceleration or deceleration over a specified number of bars), and activate a stochastic "Dropout Mode" where random measures are completely silenced so the drummer can verify if their internal time drifts.

**Blocked by:** 01 (Project Foundation & Audio Click Metronome)

**Status:** resolved

- [x] Beat selector UI allows toggling clicks on/off individually per beat in the measure (e.g. 2 & 4 jazz hi-hat feel)
- [x] Downbeat, regular beat, and subdivision clicks can be assigned distinct pitches or volumes
- [x] Tempo Ramp panel allows setting start BPM, target BPM, and bar duration for automated tempo changes
- [x] Stochastic Dropout toggle enables random measure silencing with a configurable percentage slider (e.g., 20% to 80%)
- [x] Visual indicator shows when a measure is in dropout mode without freezing the internal playhead
- [x] Tests verify that dropout gating silences audio without dropping scheduling events or losing time synchronization
