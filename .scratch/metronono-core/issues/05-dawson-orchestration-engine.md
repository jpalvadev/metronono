# 05: Alan Dawson Orchestration Engine & Drum Sample Playback

**What to build:** The core Alan Dawson interpretation engine that maps the active Reading Line onto drum kit voices over a continuous ostinato (such as a swing jazz ride pattern with hi-hat pedal on beats 2 and 4). Short notes (eighth notes) trigger the snare drum, while long notes (quarter notes and tied values) trigger the bass drum. The user can switch to the Inverted Dawson system (short notes to kick, long notes to snare) and adjust independent volume sliders for the metronome click, ostinato pattern, and orchestrated drum line.

**Blocked by:** 04 (Single-Line Reading View with Real-time Playhead)

**Status:** ready-for-agent

- [ ] Built-in sample bank loads lightweight acoustic drum samples (Kick, Snare, Ghost Snare, Ride, Hi-Hat foot/closed) via Tone.js
- [ ] Dawson mapping engine resolves a ReadingLine into a flat chronological stream of `ScheduledDrumEvents`
- [ ] Classic Bop System implemented: Jazz Ride swing ostinato (`1 2-and 3 4-and`) + Hi-Hat on 2 and 4, Short Note -> Snare, Long Note -> Kick
- [ ] Inverted Bop System toggle: Short Note -> Kick, Long Note -> Snare
- [ ] Rock / Straight-Eighth Ostinato option with hi-hat pulse on eighths
- [ ] Audio mixer controls provide independent gain/mute for: Metronome Click, Ostinato, and Orchestrated Line
- [ ] Unit tests verify that Dawson event translation produces accurate microtiming offsets without voice collision
