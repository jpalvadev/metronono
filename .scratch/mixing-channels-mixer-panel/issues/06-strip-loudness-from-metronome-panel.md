# 06: One Place for Loudness — Metronome Panel Stripped

**What to build:** Loudness controls exist in exactly one place: the Mixer Panel. The Metronome panel keeps only practice controls — tempo, tap tempo, time signature, beat mask, tempo ramp, dropout, click voices and their velocity shaping — and holds no volume slider, no mute button, and no volume state of its own. Nothing the drummer used to do with the removed controls is lost: the Master row in the Mixer Panel covers it, and per-click-voice volumes remain velocity shaping inside the Click channel. The Metronome panel's component suite asserts that no loudness control remains in it, and the master-slider assertions it used to carry live on in the Mixer Panel suite.

**Blocked by:** 05 (Mixer Panel With Practice Presets)

**Status:** resolved

- [x] The master slider block and the mute button are removed from the Metronome panel, along with the volume state, the volume-change handler, and the mute handler that zeroed and restored volume
- [x] No component outside the Mixer Panel exposes a loudness control; a rendered-Metronome test asserts the absence of volume and mute controls
- [x] Master-volume assertions formerly exercised through the Metronome panel's slider exist in the Mixer Panel suite instead
- [x] Per-click-voice volume and pitch settings keep working inside the Click channel, independent of channel loudness
- [x] The Master in the mixer state carries volume only — no muted concept remains anywhere
- [x] All pre-existing suites still pass

## Answer

**The Metronome panel is now practice controls only.** `src/components/Metronome.tsx` lost the `Master Volume` block: the mute button (`aria-label="Toggle mute"`), the `Slider` labelled `Volume`, the `volumePercent` readout, the `volume` state seeded from `scheduler.getVolume()`, the `handleVolumeChange` handler and the `toggleMute` handler that zeroed volume and restored the hard-coded 0.8, plus the `Volume1`/`Volume2` icons that only that button used. Nothing replaced them in the panel: the Master row in the Mixer Panel is the one place loudness is set, and it was mounted directly below the Metronome panel in ticket 05. The scheduler's `getVolume`/`setVolume` remain as its Master-volume facade - `AudioMixer.setMasterVolume` is still what they write - but no component calls them any more.

**Velocity shaping stays, and it is not loudness.** The three click-voice sliders (`Downbeat volume`, `Regular volume`, `Subdivision volume`) and their pitch inputs remain in the Click Sounds panel and still go through `scheduler.updateVoiceConfig`, which shapes the velocity of each voice inside the Click Channel; changing one never touches the Click Channel's own volume. A repo-wide look at `aria-label`/`ariaLabel` in `src/components` finds loudness controls in exactly one component: `MixerPanel` (`Master Volume` plus the three channel sliders). The only other `Muted` strings in the app are the beat-mask buttons (`Beat 1: Active` / `Beat 1: Muted`), which enable or skip a beat rather than change loudness.

**What the tests now say.** `src/components/__tests__/Metronome.test.tsx` replaces "adjusts master volume via volume slider" with "holds no loudness control of its own": rendered panel never calls the scheduler's `getVolume` or `setVolume`, has no `Volume` labelled slider and no mute button - and the click-voice sliders are still there and still write `updateVoiceConfig('downbeat', { volume: 0.6 })` without ever reaching `setVolume`. The master-slider assertion it used to carry (`setVolume(0.5)` from a slider drag) lives on as the Mixer Panel suite's "carries the Master volume and nothing else", which drags `Master Volume` to 0.5 and reads `mixer.getMasterVolume()`, and asserts the Master row holds no mute button. `src/__tests__/App.test.tsx` asserts the whole rendered app exposes Master/Click/Ostinato/Orchestrated-Line volume controls and channel mute buttons exactly once, and that the Metronome panel exposes neither a `Volume` slider nor a `Toggle mute` button.

**Checks** - `npx vitest run`: 31 files / 326 tests pass. `npx tsc --noEmit`: clean.

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Implementation Decision 2, user stories 9, 19, 20). Last ticket of the feature; after it, `PENDING.md` item 1 is satisfied except for the deferred persistence follow-up recorded there.
