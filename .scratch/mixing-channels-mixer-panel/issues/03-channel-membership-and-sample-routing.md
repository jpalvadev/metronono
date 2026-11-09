# 03: Strokes Obey the Mixing Channel They Were Composed Into

**What to build:** With the user's own uploaded kit loaded, muting Orchestration silences the orchestrated strokes while the Ostinato keeps playing; uploading a click sample and routing it to a click voice makes it obey the Click channel; a stroke composed as an Orchestrated Stroke responds to the Orchestration slider even when its voice name would suggest the Ostinato. No custom sample ever reaches the output outside a Mixing Channel. Channel membership comes from the source carried by each scheduled orchestration event — what the drummer composed — not from guessing at the voice name; voice-name inference survives only as the default for a bare Audition call that has no composed context.

**Blocked by:** 02 (Eagerly-Built Audio Graph With a Single Master)

**Status:** ready-for-agent

- [ ] Uploaded drum samples play through the Mixing Channel their event's source names, and the previous straight-to-output fallback is removed
- [ ] Uploaded click samples route through the Click channel and obey its volume and mute
- [ ] Ostinato strokes resolve to the Ostinato channel and orchestrated strokes to the Orchestration channel based on the event's source, verified through the audio scheduler's public API with the fake Tone harness
- [ ] Muting Orchestration silences orchestrated strokes but leaves the Ostinato audible, and vice versa, with the built-in kit and with uploaded samples alike
- [ ] The event source field is extended or tightened where needed so every scheduled stroke names its channel explicitly
- [ ] Voice-name inference remains only as the default for a bare Audition call with no composed context
- [ ] All pre-existing suites still pass

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Implementation Decision 3, user stories 7, 8, 16). Glossary: Mixing Channel, Audition.
