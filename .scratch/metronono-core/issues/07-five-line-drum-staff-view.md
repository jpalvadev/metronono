# 07: 5-Line Drum Staff View & Percussion Clef Editor (PAS Standard)

**What to build:** A full 5-line percussion score view adhering to the standard Percussion Arts Society (PAS) drum notation guidelines. Cross noteheads ($\times$) represent cymbals and hi-hats, while standard oval noteheads represent snare, kick, and toms at standardized vertical heights, with independent stem directions (hands stem-up, feet stem-down). The user can toggle between the 1-line Reading View and the 5-line Drum Staff View with a single click, and edit notes directly onto the 5-line drum staff to transcribe or modify exercises.

**Blocked by:** 06 (Custom Subdivision Formulas & Multi-Limb Orchestration Editor)

**Status:** resolved

- [x] VexFlow 5 percussion staff renders standard PAS heights: Hi-Hat top space (cross), Snare 3rd space, Kick 1st space, Toms on upper lines/spaces
- [x] Multi-voice rendering separates cymbal/snare gestures (stems up) from bass drum/foot gestures (stems down)
- [x] View Mode Toggle switch allows instantaneous switching between "Reading View (1 line)" and "Drum Staff View (5 lines)"
- [x] Interactive notation input allows adding, changing, or deleting drum hits on the 5-line staff using click or keyboard shortcuts
- [x] Real-time playhead cursor syncs across the 5-line staff simultaneously with audio playback
- [x] Unit and visual regression tests ensure notation formatting and voice separation remain valid
