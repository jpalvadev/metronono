# 02: Per-voice click rows & 1–8 subdivision slider in Mixer Panel

**What to build:** Replace the single `Metronome Click` master row in the Mixer Panel with three independent rows (`Downbeat`, `Regular`, `Subdivision`), each with its own Mute toggle and 0–100% Volume slider, plus a discrete `1`–`8` subdivision slider on the `Subdivision` row. Keep the internal `click` Mixing Channel fixed at 100% and unmuted so the persistent native node budget (`<= 10`) is preserved.

**Blocked by:** 01 (Per-voice click mute & config subscription)

**Status:** ready-for-agent

- [ ] Mixer Panel no longer renders the `Metronome Click` master row or any global click mute/volume control
- [ ] Mixer Panel renders three independent rows for `Downbeat`, `Regular`, and `Subdivision`, each with a Mute/Unmute button, a level readout (`MUTED`, `SILENT`, or `<N>%`), and a 0–100% Volume slider
- [ ] Muting a click voice preserves its slider position and displays `MUTED`; unmuting restores the previous level
- [ ] `Subdivision` row includes a discrete integer slider from `1` to `8` (`step = 1`) controlling Gap Clicks divisions (`1` = quarter note / no gap clicks through `8` = 32nd-note / fusa) and displaying the active number
- [ ] `Subdivision` volume slider and Mute button remain editable even when divisions are set to `1`
- [ ] `Ostinato` and `Orchestrated Line` rows retain their existing behavior (including inert state for No Ostinato)
- [ ] Component and App integration tests pass (`npm run check`)
