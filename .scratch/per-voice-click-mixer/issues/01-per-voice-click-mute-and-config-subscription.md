# 01: Per-voice click mute & config subscription

**What to build:** Support independent `muted` state (`false` by default) on each metronome click voice (`downbeat`, `regular`, `subdivision`) and notify listeners when click configuration changes, so muted click voices produce no scheduled audio while preserving their stored volume and leaving Audition unaffected.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `downbeat`, `regular`, and `subdivision` voice configs carry a `muted: boolean` flag defaulting to `false`
- [ ] Toggling or setting `muted` on any click voice preserves its stored `volume` and `divisions`
- [ ] Click configuration changes notify registered listeners cleanly (with unsubscribe support)
- [ ] During transport playback, muting `downbeat`, `regular`, or `subdivision` suppresses audio scheduling only for that voice while leaving the other voices audible at their configured volumes
- [ ] `Audition` playback for any click voice remains audible regardless of that voice's `muted` state
- [ ] Domain and scheduler unit tests pass (`npm run check`)
