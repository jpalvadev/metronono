# 06: One Place for Loudness — Metronome Panel Stripped

**What to build:** Loudness controls exist in exactly one place: the Mixer Panel. The Metronome panel keeps only practice controls — tempo, tap tempo, time signature, beat mask, tempo ramp, dropout, click voices and their velocity shaping — and holds no volume slider, no mute button, and no volume state of its own. Nothing the drummer used to do with the removed controls is lost: the Master row in the Mixer Panel covers it, and per-click-voice volumes remain velocity shaping inside the Click channel. The Metronome panel's component suite asserts that no loudness control remains in it, and the master-slider assertions it used to carry live on in the Mixer Panel suite.

**Blocked by:** 05 (Mixer Panel With Practice Presets)

**Status:** ready-for-agent

- [ ] The master slider block and the mute button are removed from the Metronome panel, along with the volume state, the volume-change handler, and the mute handler that zeroed and restored volume
- [ ] No component outside the Mixer Panel exposes a loudness control; a rendered-Metronome test asserts the absence of volume and mute controls
- [ ] Master-volume assertions formerly exercised through the Metronome panel's slider exist in the Mixer Panel suite instead
- [ ] Per-click-voice volume and pitch settings keep working inside the Click channel, independent of channel loudness
- [ ] The Master in the mixer state carries volume only — no muted concept remains anywhere
- [ ] All pre-existing suites still pass

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Implementation Decision 2, user stories 9, 19, 20). Last ticket of the feature; after it, `PENDING.md` item 1 is satisfied except for the deferred persistence follow-up recorded there.
