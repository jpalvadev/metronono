# 03: Strokes Obey the Mixing Channel They Were Composed Into

**What to build:** With the user's own uploaded kit loaded, muting Orchestration silences the orchestrated strokes while the Ostinato keeps playing; uploading a click sample and routing it to a click voice makes it obey the Click channel; a stroke composed as an Orchestrated Stroke responds to the Orchestration slider even when its voice name would suggest the Ostinato. No custom sample ever reaches the output outside a Mixing Channel. Channel membership comes from the source carried by each scheduled orchestration event — what the drummer composed — not from guessing at the voice name; voice-name inference survives only as the default for a bare Audition call that has no composed context.

**Blocked by:** 02 (Eagerly-Built Audio Graph With a Single Master)

**Status:** resolved

- [x] Uploaded drum samples play through the Mixing Channel their event's source names, and the previous straight-to-output fallback is removed
- [x] Uploaded click samples route through the Click channel and obey its volume and mute
- [x] Ostinato strokes resolve to the Ostinato channel and orchestrated strokes to the Orchestration channel based on the event's source, verified through the audio scheduler's public API with the fake Tone harness
- [x] Muting Orchestration silences orchestrated strokes but leaves the Ostinato audible, and vice versa, with the built-in kit and with uploaded samples alike
- [x] The event source field is extended or tightened where needed so every scheduled stroke names its channel explicitly
- [x] Voice-name inference remains only as the default for a bare Audition call with no composed context
- [x] All pre-existing suites still pass

## Answer

`src/audio/__tests__/ChannelMembership.test.ts` drives the scheduler's public API (`setDawsonEngine`,
`setReadingLine`, `start`, `applyCustomSampleBuffer`, `onDrumHit`) over the recording fake Tone, with a
real `DawsonEngine` (Straight Rock Ostinato) and a 4/4 line of quarter notes so every beat carries both
an Ostinato stroke and an Orchestrated Stroke.

- Membership: fired transport repeats trigger `rig:ostinato:mix:*` and `rig:orchestration:mix:*` only, and
  never an `:audition:` rig. An orchestrated `ride` triggers `rig:orchestration:mix:ride` while
  `rig:ostinato:mix:ride` stays unplayed, and is loudness-shaped by the Orchestration slider (0.3 written on
  `mixer:orchestration`), proving membership follows the event's `source`, not the voice name.
- Isolation: muting Orchestration freezes every Orchestration rig trigger count while Ostinato rigs keep
  triggering; unmuting it and muting Ostinato reverses exactly. Same with the user's own kit loaded: muting
  Orchestration creates no `sample:orchestration:mix` node at all, `mixer:orchestration` holds 0, and
  `sample:ostinato:mix` keeps playing.
- Samples: every `sample:<lane>:mix` gain node feeds `mixer:<lane>`, and the only route from a sample to the
  audio destination is sample → Mixing Channel → `mixer:master` → destination. An uploaded click sample's
  gain node feeds `mixer:click` and its route is exactly `mixer:click` → `mixer:master` → destination; muting
  Click writes 0 on `mixer:click`, and setting Click to 0.25 writes 0.25 there. `destination.incoming` is the
  Master alone in every case, so no sample ever bypasses a Mixing Channel: the old straight-to-output
  fallback is gone (removed with ticket 02's graph, verified here).
- Source field: `ScheduledDrumEvent.source: 'ostinato' | 'orchestration'` was already required, so no
  scheduled stroke can omit its channel; every hit the scheduler hands a listener names one. No change was
  needed beyond keeping `DrumKitPlayer.play` reading `event.source`.
- Inference: `triggerVoice` with no named channel auditions a ride on Ostinato and a kick on Orchestration;
  naming the channel overrides the voice name; a composed event's source always wins.

Full suite green (32 files, 281 tests); `tsc --noEmit` clean.

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Implementation Decision 3, user stories 7, 8, 16). Glossary: Mixing Channel, Audition.

