# 04: Silent Channels Don't Light Pads; Audition Is Always Audible

**What to build:** What the interface shows matches what the drummer hears. Mute Orchestration and its hits in the Real-Time Drum Monitor stay dark while the Ostinato's hits keep lighting their pads, and the Reading View playhead keeps advancing on every channel setting so unmuting resumes mid-measure with nothing lost. Meanwhile, opening the Sample Bank or previewing a Subdivision Formula or drum pad with every Mixing Channel muted still produces sound: Audition is routed past the mutes to the Master, shaped by channel volume but not silenced by channel mute. Throughout, the audible-or-not decision is asked from the mixer — no other module recomputes loudness from a gain node's current value, and the beat scheduler gains no second gate: orchestration resolution and seed reproducibility behave exactly as before.

**Blocked by:** 02 (Eagerly-Built Audio Graph With a Single Master), 03 (Strokes Obey the Mixing Channel They Were Composed Into)

**Status:** ready-for-agent

- [ ] A stroke in a channel whose effective volume is 0 — muted or dragged to zero — is not delivered to the drum-hit listeners, so its drum pads stay dark
- [ ] A stroke in an audible channel is delivered to the drum-hit listeners as before
- [ ] The playhead keeps moving and the exercise keeps running on every channel setting, verified through the audio scheduler's public API
- [ ] Audibility is queried from the mixer via a single audible-or-not question per channel; no module reads a gain node's value to decide audibility
- [ ] Audition — Sample Bank previews, Subdivision Formula previews, drum pad previews — remains audible while its channel is muted, routed past the channel gain to the Master
- [ ] Channel volume still shapes Audition: a channel at zero volume is silent even when auditioning
- [ ] No new mute gate is added to the tick: mute remains channel gain to zero
- [ ] All pre-existing suites still pass

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Implementation Decisions 4 and 5, user stories 11, 12, 15). The Audition exception is deliberate and recorded in ADR-0005 — it is not an inconsistency to fix.
