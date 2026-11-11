# 01: Remove Real-Time Drum Monitor UI and Rename Section

**What to build:** The Alan Dawson section is cleared of the 4-pad Real-Time Drum Monitor (Ride Cymbal, Snare Drum, Bass Drum, Hi-Hat Pedal) and its audition prompts, removing visual distraction and blinking from playback. The section title is cleanly updated to "Alan Dawson Orchestration". Pad auditioning is completely retired, while formula audition and Sample Bank previews continue to work as before.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The 4-pad visual display (RH Ride, LH Snare, RF Bass Drum, LF Hi-Hat) and the "Real-Time Drum Monitor" / "Click pad to audition" header are removed from the Alan Dawson section.
- [ ] Active pad states, animation timeouts, and pad tap audition callbacks are removed from the component.
- [ ] The section heading reads "Alan Dawson Orchestration".
- [ ] Component and application tests assert the presence of the updated heading and the absence of drum pads or monitor text.
- [ ] Existing formula audition buttons and dialogs continue to function properly.
