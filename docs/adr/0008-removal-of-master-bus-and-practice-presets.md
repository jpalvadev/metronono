# 0008. Removal of Master Bus and Practice Presets

The Master volume slider and Practice Presets were introduced to provide macro loudness control and preset mute configurations across the three Mixing Channels. However, having both a master volume and individual channel faders added unnecessary redundancy to the user experience, while practice presets added state complexity for mute combinations that drummers adjust directly on the individual channels. We decided to eliminate the Master gain node and Practice Presets entirely, connecting the three Mixing Channels (Click, Ostinato, Orchestration) directly to the audio destination (`Tone.Destination`) and retaining only the three channel rows with their volume sliders and mute toggles.

## Considered Options

- **Keep the Master gain node internally at unity gain (1.0) and remove only the UI.** Rejected: leaves dead code, unused state, and unnecessary gain node hops in the Web Audio graph.
- **Keep Practice Presets in the model without UI buttons.** Rejected: presets served only the UI buttons, adding unused logic once the row is removed.

## Consequences

- In `AudioMixer`, `master` state, `getMasterVolume()`, `setMasterVolume()`, and `getMasterNode()` are retired. Each Mixing Channel's main and audition gain nodes connect directly to `Tone.Destination`.
- `ToneTransportScheduler` no longer exposes master volume controls.
- `PracticePresets.ts` and its test suite are removed. The `composedChannels` helper (which determines whether an ostinato is actively composed) is retained within `AudioMixer.ts` to support rendering the inactive channel placeholder.
- In `MixerPanel`, the Preset row and Master row are removed, leaving solely the three Mixing Channel rows.
- Amends ADR-0005.
