# Spec: Mixing Channels & Mixer Panel

Status: ready-for-agent

## Problem Statement

The app promises independent control over the Metronome click, the Ostinato, and the orchestrated drum line, but none of it works. Dragging any of the three channel sliders changes the number on screen and nothing changes in the audible output. Muting a channel flips its label to MUTED and still lets it sound. The user cannot mute the app's drum sounds and play the Reading Line orchestration themselves over just the click, which is the single most important practice configuration in the whole app.

Worse, the built-in synthesized drum kit is completely silent. Only the click is heard. A drummer who has uploaded their own WAV samples hears them, but those samples ignore every channel slider and mute, going straight to the output. Meanwhile the Real-Time Drum Monitor pads light up on hits that make no sound at all, so the interface reports a performance the user cannot hear.

The loudness controls are also in the wrong place and duplicated: the only way to silence the drums is to scroll down to the Alan Dawson section and mute two channels there, while a separate master volume slider and mute button sit inside the Metronome panel far above. Two master volumes are stacked in series, so the master slider tops out around 64% instead of 100%.

## Solution

The three Mixing Channels become real. Each one is an audibility lane of the practice output — Click, Ostinato, or Orchestration — with its own volume and mute, all feeding one Master. Everything the app sounds is routed through its named channel, so a slider moves exactly what its label claims, and a mute is honored by the built-in kit, the ostinato, the orchestration, and the user's own samples alike.

A dedicated **Mixer Panel** sits directly under the transport controls, next to the PLAY button, holding the Master plus the three channels and a row of **Practice Presets**: **Click Only**, **Drums Only**, **Full Mix**, and a derived **Custom** state. One press gives the drummer the two configurations the original request was about: play the Metronome alone with no sight-reading orchestration sound, or run the Alan Dawson exercise with no click. Presets only change mutes, never the volumes the drummer has tuned by ear.

Muting a channel silences it completely: no sound, and no drum-pad illumination for strokes in that channel. The Reading View playhead and the exercise itself keep running regardless, so unmuting resumes mid-measure with nothing lost. Loudness controls are removed from the Metronome panel, leaving it for practice controls only.

Underneath, the whole audio graph is built once, eagerly, and completely: the objects the interface reads are the same objects Tone.js sounds through. This is what makes the fix permanent rather than a patch of one symptom.

## User Stories

1. As a drummer, I want the three channel sliders to actually change what I hear, so that I can trust the mixer instead of second-guessing it.
2. As a drummer, I want to silence the Ostinato and Orchestration channels and keep only the Click, so that I can play the Reading Line orchestration myself over a bare Metronome.
3. As a drummer, I want to silence the Click and hear only the orchestrated exercise, so that I can check whether my own timekeeping matches the app's.
4. As a drummer, I want to hear the Ostinato groove alone without the orchestrated line, so that I can practice comping or solo over it.
5. As a drummer, I want one press to switch between Click Only, Drums Only, and Full Mix, so that I can change practice mode without hunting through three separate mutes.
6. As a drummer, I want the built-in drum kit — kick, snare, ghost snare, toms, ride, hi-hat, crash — to make sound at all, so that the Dawson systems are actually audible out of the box.
7. As a drummer who uploaded my own samples, I want those samples to obey the same channel sliders and mutes as the built-in kit, so that switching to my recorded kit does not break the mixer.
8. As a drummer, I want every click voice — downbeat, regular, subdivision, and my own uploaded click samples — to obey the Click channel, so that muting the Click truly silences the Metronome.
9. As a drummer, I want exactly one master loudness control, so that 100% means 100% and I do not have to compensate for a hidden second volume stage.
10. As a drummer, I want the loudness controls directly beneath the transport controls, so that I can see what I am about to hear before I press PLAY.
11. As a drummer, I want a muted channel to stop lighting its Real-Time Drum Monitor pads, so that what the interface shows matches what I hear.
12. As a student, I want the Reading View playhead to keep advancing on every channel setting, so that muting a channel never costs me my place in the measure.
13. As a drummer, I want a Practice Preset to leave my slider values untouched, so that switching practice mode never destroys a gain balance I tuned by ear.
14. As a drummer, I want the preset row to show Custom when I have hand-tuned the channels, so that the buttons always tell me the truth about my current mix.
15. As a drummer configuring the Sample Bank, I want Audition to be audible even while its channel is muted, so that I can load and check a sample without first changing my practice configuration.
16. As a drummer, I want an orchestrated stroke to respond to the channel it was composed into, so that a formula assigning a hi-hat foot stroke as an Orchestrated Stroke is controlled by the Orchestration slider and not the Ostinato one.
17. As a student using a Dawson System with No Ostinato, I want that option to mean "this system has no Ostinato layer" and not "the Ostinato is muted", so that the two ideas never blur.
18. As a drummer, I want the Ostinato channel to read as inert when the active Dawson System composes no Ostinato, so that I am not offered a control with nothing behind it.
19. As a drummer, I want the Metronome panel to hold only practice controls — tempo, tap tempo, beat mask, tempo ramp, dropout, click voices — with no duplicated loudness control, so that there is one obvious place to change volume.
20. As a drummer, I want the per-click-voice volume and pitch settings to keep working inside the Click channel, so that accent shaping and channel loudness remain independent.
21. As a drummer, I want the mixer to behave identically in the packaged Android app, so that practice on my phone matches practice at the desk.
22. As a contributor, I want the mixer the interface reads to be the mixer the audio graph uses, so that this defect cannot quietly return.
23. As a contributor, I want a test that reproduces the real failure order — interface reads the mixer before playback has ever started — so that the fix is provably a fix.
24. As a contributor, I want the vocabulary of loudness to be unambiguous in the glossary, so that "mute", "No Ostinato", and "Audition" mean one thing each across the codebase.

## Implementation Decisions

### 1. One eagerly-built audio graph (ADR-0005)

- The audio graph is constructed completely once per scheduler instance, before any playback: three Mixing Channel gains feeding one Master gain, which feeds the Tone destination. It is no longer assembled lazily during the first PLAY.
- The scheduler accessors for the mixer and the drum kit return those wired objects. They are no longer permitted to fabricate un-wired stand-ins for the caller. That fabrication is the root cause: the interface obtained a mixer with no gain nodes behind it, and initialization was then skipped because "an instance already exists".
- A build-guard flag makes construction idempotent per instance, and the application shell disposes the audio resources on unmount, so a StrictMode re-render cannot leak a second graph.
- `Tone.start()` still gates audibility until the user presses PLAY, so building the graph at page load on the Capacitor build creates a suspended context rather than audible output.

### 2. Single master volume

- The separate master-volume control class and its interface, and the corresponding dependency-injection option in the scheduler options, are removed. Loudness lives only in the mixer.
- Master mute is dropped as a distinct concept: the Metronome panel's mute button is deleted along with its volume slider, and silencing everything means dragging Master to zero.
- Each Mixing Channel multiplies its own volume by the Master. The per-click-voice volumes remain velocity shaping within the Click channel.

### 3. Channel membership is composed, not guessed

- The `source` field carried by every scheduled drum event is the authority on which Mixing Channel a stroke belongs to. Voice-name inference survives only as the default for a bare Audition call that has no composed context.
- The core spec's `ScheduledDrumEvent` shape is extended to make that explicit, alongside the audibility state:

```typescript
// Proposed state shape for the mixer and its derived preset.
export type MixingChannelId = 'click' | 'ostinato' | 'orchestration';

export interface MixingChannelState {
  volume: number;  // 0.0 - 1.0
  muted: boolean;
}

export interface MixerState {
  master: { volume: number };
  channels: Record<MixingChannelId, MixingChannelState>;
}

// A channel is audible when it is unmuted and its volume is above zero.
export type PracticePreset = 'click-only' | 'drums-only' | 'full-mix' | 'custom';
// PracticePreset is derived from MixerState, never stored alongside it.
```

### 4. Mute semantics

- Mute remains a single mechanism: the channel gain goes to zero. No second gate is added to the beat scheduler, so orchestration resolution, seed reproducibility, and the Reading View playhead continue exactly as before on every channel setting.
- A stroke in a channel that is not audible is not announced to the drum-hit listeners, so the Real-Time Drum Monitor pads respond to what is actually heard.
- The audible-or-not decision is asked from the mixer. No other module recomputes loudness from a gain node's current value.

### 5. Routing of user samples and Audition

- Click samples route through the Click channel; drum samples route through the channel their event's `source` names. The previous fallback that sent custom samples straight to the output is removed.
- Audition — Sample Bank previews, Subdivision Formula previews, and drum pad previews — is routed past Mixing Channel mutes to the Master. Channel volume still shapes it. This is a deliberate exception recorded in ADR-0005, because the Sample Bank is a full-screen overlay where the Mixer Panel is not even visible.

### 6. Mixer Panel and Practice Presets

- A dedicated Mixer Panel component holds Master, the three Mixing Channels, and the preset row, rendered by the application shell directly beneath the Metronome panel. The Alan Dawson section keeps the ostinato selector, systems, Subdivision Formulas, and the drum monitor, and loses its embedded mixer entirely.
- Loudness controls exist in exactly one place. They are not duplicated in the Metronome panel.
- Practice Presets flip mute flags only, never volume values. The lit preset is derived from the live mixer state, with Custom shown when the channels match none of the three presets.
- The ostinato selector's third option is renamed from "Silenced" to **No Ostinato**, marking a composition choice. The Ostinato channel row renders inert when no Ostinato is composed.

### 7. Unchanged

- The Lookahead Scheduler's tick order, the beat mask, dropout mode, tempo ramps, tap tempo, procedural generation, the Reading Line → Dawson resolution path, and both notation views are untouched. Only the audibility of what they already produce changes.

## Testing Decisions

Good tests here assert externally observable behavior only: which node is connected to which, what a channel's gain reaches after a mute, whether a drum-hit listener fires, and what a rendered button says. Private fields, internal helper calls, and scheduling internals are not asserted.

**Seam 1 — the audio scheduler's public API (primary seam).** Everything about the graph is observed through the scheduler that the interface already talks to: its mixer and drum kit accessors, master volume accessors, start and stop, the mixer's channel controls, and the drum-hit subscription. Behavior to cover:

- Accessors return wired objects, and the graph shape is verified as Click, Ostinato and Orchestration all connected to Master, and Master connected to the destination.
- The click voices are connected through the Click channel, not to the master directly.
- Muting a channel drives that channel's gain to zero; unmuting restores the channel's own volume; volumes clamp at the 0.0 and 1.0 boundaries.
- Master volume reaches the master gain, and master volume coverage removed with the deleted master-volume control is re-homed here rather than deleted.
- A stroke in an inaudible channel is not delivered to the drum-hit listeners; a stroke in an audible channel is.
- Uploaded samples land in the channel their `source` names.
- Audition is audible while its channel is muted.
- Built-in drum voices produce sound rather than silently no-opping.

Because jsdom has no AudioContext, a shared recording fake Tone module — fake gain and synth nodes that record every connection, plus a graph snapshot the tests can assert against — is registered per test suite, never globally. This stops the class of test that injects the very nodes production forgot to build, which is precisely how the current suite passes while the feature is broken.

**Regression guard.** One test drives the real failure order: build the scheduler, read the mixer and drum kit accessors the way the components do at mount, then start playback. It must fail before the fix and pass after.

**Seam 2 — the React component seam (existing seam, reused).** The Mixer Panel is tested as a rendered component against a fake scheduler, following the established pattern in the Metronome and Dawson section component suites. Covers: presets flip mutes without touching volumes, the derived Custom state, the inert Ostinato row, and the absence of any loudness control in the Metronome panel. Existing mixer assertions currently living in the Dawson section suite move to the Mixer Panel suite.

**Prior art.** Component suites that inject a fake scheduler; the audio scheduler suite that injects a fake transport and asserts scheduling behavior; the mixer suite that asserts state, clamping, mute retention, and gain-node ramping.

## Out of Scope

- Persisting Mixer Panel and Practice Preset state across sessions. The storage subsystem has no settings record today, and adding one would touch the export and import archive format. Recorded in `PENDING.md`.
- Subdivision / gap clicks. They are configurable and auditionable but never scheduled during playback, so an uploaded subdivision click sample can never be heard in a practice run. Recorded in `PENDING.md`.
- Making the built-in synthesized drum kit sound more acoustic. Restoring audibility is in scope; sample realism is not.
- Extending the mixer with panning, equalization, per-voice channels, or more than three Mixing Channels.
- Making the 5-line Drum Staff View editor affect playback. Its edits remain local to that view.
- Practice mode layouts that hide whole sections of the interface. Once the Mixing Channels are real, any such layout is a preset of these channels and can come later.

## Further Notes

- Respects and extends ADR-0004 (Tone.js as the audio transport). The graph shape, the single master, the refusal to fabricate un-wired objects, and the Audition exception are recorded in ADR-0005.
- Vocabulary added to `GLOSSARY.md`: **Mixing Channel**, **Practice Preset**, **Audition**, **No Ostinato**. "Mode" is deliberately avoided as a name for the presets, because the Reading Training section already uses that word for choosing the Reading Line source.
- Satisfies the unmet promise in user story 17 of the Metronono Core spec ("mute the app's drum sounds and play the exercises myself over just the click and ostinato"), which ticket 05 delivered as gain only.
- Consequence worth knowing up front: building the graph at page load means Tone.js creates its AudioContext before any user gesture on the Capacitor Android build. Output stays silent until PLAY, and the build guard plus disposal on unmount keep React's StrictMode double-render from creating a second graph.
