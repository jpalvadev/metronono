# 01: Remove Real-Time Drum Monitor UI and Rename Section

**What to build:** The Alan Dawson section is cleared of the 4-pad Real-Time Drum Monitor (Ride Cymbal, Snare Drum, Bass Drum, Hi-Hat Pedal) and its audition prompts, removing visual distraction and blinking from playback. The section title is cleanly updated to "Alan Dawson Orchestration". Pad auditioning is completely retired, while formula audition and Sample Bank previews continue to work as before.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The 4-pad visual display (RH Ride, LH Snare, RF Bass Drum, LF Hi-Hat) and the "Real-Time Drum Monitor" / "Click pad to audition" header are removed from the Alan Dawson section.
- [x] Active pad states, animation timeouts, and pad tap audition callbacks are removed from the component.
- [x] The section heading reads "Alan Dawson Orchestration".
- [x] Component and application tests assert the presence of the updated heading and the absence of drum pads or monitor text.
- [x] Existing formula audition buttons and dialogs continue to function properly.

## Answer

`src/components/DawsonOrchestrationSection.tsx` now renders the Alan Dawson card without the monitor: the 4-pad grid, the "Real-Time Drum Monitor" label and "Click pad to audition" prompt, the `activeKick/activeSnare/activeRide/activeHihat` states with their `setTimeout` flashes, the `scheduler.onDrumHit` subscription effect, and `handlePadAudition` are all gone (as are the now-unused `DrumVoice`, `ScheduledDrumEvent`, `DrumLane` and `Activity` imports). The heading is `Alan Dawson Orchestration` and the `App.tsx` mount comment matches. `DawsonOrchestrationSection.test.tsx` and `App.test.tsx` assert the exact new heading, absence of the `drum-pad-*` testids and monitor text, and the formula Audition buttons + FormulaEditorDialog continue to work. Done in commit "feat(dawson): remove Real-Time Drum Monitor UI and rename section (ticket 01)".
