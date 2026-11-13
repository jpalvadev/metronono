Status: ready-for-agent

# Per-Voice Click Mixer & Pitch Removal

## Problem Statement

Currently, metronome click configuration is split awkwardly across two panels:

1. The **Metronome** panel contains a collapsible **"Click Sounds & Pitches"** card with three `pitch` text inputs (`Downbeat Pitch`, `Regular Pitch`, `Subdivision Pitch`), three per-voice volume sliders, and a 4-button **Gap Clicks** selector (`None`, `2×`, `3×`, `4×`). Since the migration to the pure `.wav` Sample Bank engine (ADR-0014), the `pitch` inputs are completely ignored by audio playback and confuse the user. Meanwhile, the Gap Clicks UI caps at `4×` even though the underlying engine supports up to 8 parts per beat.
2. The **Mixer Panel** exposes a single **`Metronome Click`** master row (one mute button and one volume slider) alongside **`Ostinato`** and **`Orchestrated Line`**. To balance `downbeat`, `regular`, and `subdivision` against the drum kit, the user has to jump back to the Metronome panel's collapsible card.

## Solution

Consolidate all metronome click loudness and subdivision controls into the **Mixer Panel**, remove the click master row, and remove every trace of `pitch` from the application:

1. **Remove "Click Sounds & Pitches" & all `pitch` references**: Delete the collapsible card from the Metronome panel and remove `pitch` from domain configs, scheduler/player interfaces, UI, and tests. Custom `.wav` click sounds remain managed in the Sample Bank modal.
2. **Replace the `Metronome Click` master row with 3 per-voice rows in the Mixer Panel**: Remove the single `Metronome Click` row (no master click volume or mute). Add three independent rows — **`Downbeat`**, **`Regular`**, and **`Subdivision`** — each with its own **Mute** toggle button and **Volume** slider (0–100%), matching the layout and behavior of `Ostinato` and `Orchestrated Line`.
3. **Add a `1–8` Subdivision slider on the `Subdivision` row**: Inside the `Subdivision` row in the Mixer Panel, provide a discrete integer slider from `1` to `8` (`step = 1`, from `1` = quarter note / no gap clicks up to `8` = 32nd-note / fusa), displaying the active division number. The `Subdivision` volume slider and mute toggle remain editable even when divisions are set to `1`.

## User Stories

1. As a drummer, I want the "Click Sounds & Pitches" card removed from the Metronome panel, so that the clock panel only contains timing, time signature, beat mask, tempo ramp, dropout, and play/stop controls.
2. As a drummer, I want all `pitch` inputs and references removed from the app, so that I am not presented with dead controls that have no effect on `.wav` Sample Bank playback.
3. As a drummer, I want the `Metronome Click` master row removed from the Mixer Panel, so that there is no redundant master fader sitting above per-voice click controls.
4. As a drummer, I want a dedicated **`Downbeat`** row in the Mixer Panel with a volume slider (0–100%) and mute toggle, so that I can balance or silence beat 1 directly alongside the drum layers.
5. As a drummer, I want a dedicated **`Regular`** row in the Mixer Panel with a volume slider (0–100%) and mute toggle, so that I can balance or silence non-downbeat main beats (`2, 3, 4…`) independently.
6. As a drummer, I want a dedicated **`Subdivision`** row in the Mixer Panel with a volume slider (0–100%) and mute toggle, so that I can balance or silence gap clicks independently.
7. As a drummer, I want muting any click voice (`Downbeat`, `Regular`, or `Subdivision`) to preserve its volume slider position and display `MUTED`, so that unmuting restores my exact previous mix level.
8. As a drummer, I want a discrete **`1` to `8`** slider on the `Subdivision` row of the Mixer Panel, so that I can dial in anything from quarter notes (`1`, no gap clicks) through eighth notes (`2`), triplets (`3`), 16ths (`4`), quintuplets (`5`), sextuplets (`6`), septuplets (`7`), and 32nd notes / fusas (`8`).
9. As a drummer, I want the `Subdivision` volume slider and mute button to remain editable when the division slider is at `1`, so that I can pre-adjust the subdivision level before turning subdivisions on (`2–8`).
10. As a drummer, I want setting a click voice's volume to `0%` to display `SILENT` and produce no sound for that voice without affecting the other click voices.
11. As a drummer, I want `Ostinato` and `Orchestrated Line` rows in the Mixer Panel to keep their exact existing behavior (including showing `Ostinato` as inert when No Ostinato is active).
12. As a drummer, I want Sample Bank custom `.wav` click replacement and Audition to continue working normally without any `pitch` dependency.

## Implementation Decisions

- **Vocabulary**: Preserve the canonical voice names `downbeat`, `regular`, and `subdivision` across domain, audio, and UI (per `GLOSSARY.md` and user confirmation).
- **Complete `pitch` removal**:
  - Remove `pitch` from `ClickVoiceConfig`, `SubdivisionVoiceConfig`, `createDefaultClickConfig()`, `IClickPlayer.play(...)`, and `IClickPlayer.playSubdivision(...)`.
  - Remove `handleVoicePitchChange` and all pitch inputs/labels from the Metronome UI.
- **Per-voice mute & volume in `MetronomeEngine`**:
  - Extend `ClickVoiceConfig` and `SubdivisionVoiceConfig` with `muted: boolean` (default `false` in `createDefaultClickConfig()`).
  - Add a click-config change subscription (`onClickConfigChange` or equivalent listener) on `MetronomeEngine` / `ToneTransportScheduler` so `MixerPanel` stays synchronized with any programmatic or UI updates.
  - Keep `MetronomeEngine.MIN_BEAT_DIVISIONS = 1` and `MAX_BEAT_DIVISIONS = 8`, clamping `divisions` to integer values in `[1, 8]`.
- **Audio Graph & Node Budget (`docs/adr/0005`, `docs/adr/0014`)**:
  - `AudioMixer` keeps its three Mixing Channel buses (`click`, `ostinato`, `orchestration`) and Audition nodes unchanged, preserving the `<= 10` persistent native Web Audio node budget.
  - Because there is no user-facing click master, the `click` Mixing Channel node remains at `1.0` and unmuted.
  - `ToneTransportScheduler` / `ToneClickPlayer` applies each click voice's `muted` flag and `volume` at scheduling time: a muted voice (or `volume <= 0`) schedules no audible hit for that voice (`downbeat`, `regular`, or `subdivision`), while unmuted voices schedule at their configured `volume`.
  - `ToneClickPlayer.audition(voice, ...)` continues to preview through the shared Click Audition node regardless of per-voice mute state (per `GLOSSARY.md`: Audition is independent of mutes).
- **Mixer Panel UI (`MixerPanel`)**:
  - Remove the `Metronome Click` master row (`mixer-row-click`).
  - Render three always-composed rows for `Downbeat`, `Regular`, and `Subdivision`, each with:
    - Mute / Unmute toggle button (`Mute Downbeat` / `Unmute Downbeat`, etc.)
    - Level readout (`MUTED`, `SILENT`, or `<N>%`)
    - Volume slider (`0` to `1`, `step = 0.01`, or `0–100%` mapped cleanly)
  - On the `Subdivision` row, render an additional discrete integer slider (`min = 1`, `max = 8`, `step = 1`) for `divisions`, displaying the current division count (`1`–`8`), with `Subdivision` volume and mute always interactive even when `divisions === 1`.
  - Retain the `Ostinato` and `Orchestrated Line` rows unchanged below the click rows.
- **Metronome UI (`Metronome`)**:
  - Remove the collapsible "Click Sounds & Pitches" section, its `showAccents` state, pitch/volume/gap-click handlers, and `getGapClicksLabel` helper.

## Testing Decisions

- **Testing philosophy**: Test external observable behavior through the highest practical seams — UI interactions updating domain state and scheduled Web Audio buffer/gain outputs — rather than asserting internal private methods.
- **Seams**:
  1. **Component + Scheduler + FakeWebAudio Seam** (`App` and `MixerPanel` rendered in jsdom against real `AudioMixer`, `MetronomeEngine`, and `ToneTransportScheduler`):
     - Assert `Metronome` no longer renders `Click Sounds & Pitches`, any `pitch` input, or Gap Clicks buttons.
     - Assert `MixerPanel` does not render `mixer-row-click` (`Metronome Click`) or any master click control, and renders `Downbeat`, `Regular`, `Subdivision`, `Ostinato`, and `Orchestrated Line` rows.
     - Assert changing `Downbeat`, `Regular`, and `Subdivision` sliders and mute buttons updates `MetronomeEngine.getClickConfig()` and renders `MUTED` / `SILENT` / `<N>%` accurately.
     - Assert changing the `Subdivision` divisions slider across `1..8` updates `subdivision.divisions`, while keeping `Subdivision` volume and mute editable at `1`.
  2. **Domain & Audio Scheduler Seam** (`MetronomeEngine` and `ToneTransportScheduler` with `FakeAudioContext`):
     - Assert `divisions` clamps to `1..8` and schedules `0` gap clicks at `1` up to `7` gap clicks at `8` per beat.
     - Assert muting `downbeat`, `regular`, or `subdivision` suppresses audio scheduling for only that voice while leaving the others audible at their configured volumes.
     - Assert `createDefaultClickConfig()` and `IClickPlayer` have no `pitch` property.
- **Prior art**: Follow existing patterns in `MixerPanel.test.tsx`, `App.test.tsx`, `Metronome.test.tsx`, `MetronomeEngine.test.ts`, and `ToneTransportScheduler.test.ts`.

## Out of Scope

- Modifying `SampleBankModal` or how custom `.wav` files are uploaded, stored, or auditioned.
- Changing `Ostinato` or `Orchestrated Line` mixer behavior or `No Ostinato` inert state.
- Adding a combined master click volume or master click mute.
- Persisting click mixer levels across page reloads beyond existing behavior.
