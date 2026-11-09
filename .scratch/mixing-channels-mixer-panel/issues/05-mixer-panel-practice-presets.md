# 05: Mixer Panel With Practice Presets

**What to build:** A dedicated Mixer Panel renders directly below the Metronome panel: a Master row, the three Mixing Channel rows (volume slider and mute each), and a Practice Preset row — Click Only, Drums Only, Full Mix, and a derived Custom. One press of Click Only gives the drummer a bare Metronome with no drum audio; one press of Drums Only gives the orchestrated exercise with no click; presets flip mute flags only, so slider values the drummer tuned by ear survive every preset press. The lit preset is derived from the live mixer state, and Custom lights when the channels match none of the three presets. The Alan Dawson section loses its embedded mixer card and keeps the ostinato selector, systems, Subdivision Formulas, and drum monitor; its third ostinato option is renamed from "Silenced (No Ostinato)" to **No Ostinato**, and the Ostinato Mixing Channel row renders inert when the active Dawson System composes no Ostinato.

**Blocked by:** 02 (Eagerly-Built Audio Graph With a Single Master). Can run in parallel with 03 and 04.

**Status:** ready-for-agent

- [ ] The Mixer Panel renders below the Metronome panel with Master, Click, Ostinato and Orchestration rows, each channel row offering a volume slider and a mute toggle
- [ ] Pressing a Practice Preset mutes and unmutes the right channels: Click Only (Ostinato + Orchestration muted), Drums Only (Click muted, channels with composed content unmuted), Full Mix (nothing muted)
- [ ] A preset press never changes any volume value
- [ ] The lit preset is derived from the mixer's live state on every render; Custom appears when no preset matches, and hand-tuned mutes re-light a preset when they happen to match one
- [ ] Master control exists in the panel; the mixer state's master carries volume only
- [ ] The embedded mixer card is removed from the Alan Dawson section, which keeps its ostinato selector, systems, Subdivision Formulas and drum monitor
- [ ] The ostinato selector's third option reads "No Ostinato", and it still means no Ostinato layer is composed — distinct from muting the Ostinato Mixing Channel
- [ ] When the active Dawson System composes no Ostinato, the Ostinato Mixing Channel row renders inert rather than offering a control with nothing behind it
- [ ] The panel is tested at the React component seam against a fake scheduler, following the pattern of the existing Metronome and Dawson section component suites
- [ ] The mixer assertions that lived in the Dawson section suite move into the new Mixer Panel suite rather than being deleted
- [ ] All pre-existing suites still pass

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Implementation Decision 6, user stories 5, 10, 13, 14, 17, 18). Glossary: Mixing Channel, Practice Preset, No Ostinato. "Mode" is avoided as a name — the Reading Training section already uses that word.
