# 03: Remove Click Sounds & Pitches from Metronome & eliminate all pitch references

**What to build:** Remove the collapsible "Click Sounds & Pitches" section from the Metronome panel and delete every remaining `pitch` field, parameter, handler, and test reference across the entire codebase, leaving Sample Bank `.wav` customization intact and verifying the full suite passes.

**Blocked by:** 02 (Per-voice click rows & 1–8 subdivision slider in Mixer Panel)

**Status:** ready-for-agent

- [ ] Metronome panel no longer renders the "Click Sounds & Pitches" collapsible card, pitch inputs, per-voice volume sliders, or Gap Clicks buttons
- [ ] No `pitch` property exists on click voice configs or default click config factories
- [ ] Click player and scheduler interfaces/implementations no longer accept or pass `pitch` arguments
- [ ] Zero `pitch` references remain in application source or test files
- [ ] Sample Bank custom `.wav` replacement and Audition continue working as expected
- [ ] Full verification suite (`npm run check`) passes cleanly
