# 04: Silent Channels Don't Light Pads; Audition Is Always Audible

**What to build:** What the interface shows matches what the drummer hears. Mute Orchestration and its hits in the Real-Time Drum Monitor stay dark while the Ostinato's hits keep lighting their pads, and the Reading View playhead keeps advancing on every channel setting so unmuting resumes mid-measure with nothing lost. Meanwhile, opening the Sample Bank or previewing a Subdivision Formula or drum pad with every Mixing Channel muted still produces sound: Audition is routed past the mutes to the Master, shaped by channel volume but not silenced by channel mute. Throughout, the audible-or-not decision is asked from the mixer — no other module recomputes loudness from a gain node's current value, and the beat scheduler gains no second gate: orchestration resolution and seed reproducibility behave exactly as before.

**Blocked by:** 02 (Eagerly-Built Audio Graph With a Single Master), 03 (Strokes Obey the Mixing Channel They Were Composed Into)

**Status:** resolved

- [x] A stroke in a channel whose effective volume is 0 — muted or dragged to zero — is not delivered to the drum-hit listeners, so its drum pads stay dark
- [x] A stroke in an audible channel is delivered to the drum-hit listeners as before
- [x] The playhead keeps moving and the exercise keeps running on every channel setting, verified through the audio scheduler's public API
- [x] Audibility is queried from the mixer via a single audible-or-not question per channel; no module reads a gain node's value to decide audibility
- [x] Audition — Sample Bank previews, Subdivision Formula previews, drum pad previews — remains audible while its channel is muted, routed past the channel gain to the Master
- [x] Channel volume still shapes Audition: a channel at zero volume is silent even when auditioning
- [x] No new mute gate is added to the tick: mute remains channel gain to zero
- [x] All pre-existing suites still pass

## Answer

**One audible-or-not question, answered once.** `AudioMixer.isChannelAudible(channel)` now asks `getEffectiveVolume(channel) > 0` instead of `!muted`: a Mixing Channel whose slider is dragged to zero is silent in exactly the same way its mute makes it silent. Silence is still written on the channel's own gain node (`AudioMixer.updateChannelNodes`), and no other module reads a gain node's value to decide anything — `DrumKitPlayer` and `ToneTransportScheduler` both call that one method.

**Pads follow the audio.** `DrumKitPlayer.play` already returns before triggering when its channel is not audible, so a silent line now triggers nothing at all, including at zero volume. `ToneTransportScheduler.scheduleTicks` gates only the `drumHitListeners` notification on `this.audioMixer.isChannelAudible(drumEvent.source)`: the strokes are still resolved and still handed to `drumKitPlayer.play`, the beat and dropout listeners still fire on every tick, and `scheduler.isPlaying()` stays true, so the Reading Line and playhead keep running and unmuting resumes mid-measure. No second mute gate was added to the tick, and orchestration resolution and seed reproducibility are untouched.

**Audition bypasses the mute but not the volume.** The drum lanes already had an Audition rig per channel; what was missing was Click. `ToneClickPlayer` now builds a second, identical voice set (`click:audition:downbeat|regular|subdivision`, plus an audition sample gain `click-sample-audition-gain`) wired onto the Audition node the Click Channel shares, and `scheduler.auditionVoice('click_*')` plays through the new `IClickPlayer.audition(voice)` — an injected click player without an audition path falls back to the audible line it already has. `AudioMixer` holds each Audition node at the channel volume and never writes a mute to it, so a preview is heard at the volume the muted channel's slider holds, and a channel dragged to zero is silent even when auditioning.

**Tests** — `src/audio/__tests__/ChannelAudibility.test.ts`, 15 tests through the recording fake Tone harness (written red first: 14 of 15 failed before the production change):

- A channel at zero volume produces no rig triggers, its route reaches nothing, and its uploaded samples are never played, while the other channels keep sounding.
- Neither a muted nor a zero-volume channel announces a Drum Hit; the other channel's hits keep arriving; unmute or turning the volume back up restores both sound and hits.
- With Orchestration muted, its composed strokes are still scheduled (`drumKitPlayer.play` is called for them), no hit is delivered for them, and all four beats still pulse in order.
- `auditionVoice('kick')` on muted Orchestration triggers `rig:orchestration:audition:kick` along `audition:orchestration → mixer:master → destination` at the held channel volume; `auditionVoice('click_regular')` and `auditionVoice('click_subdivision')` reach the output through `audition:click` and never through the muted `mixer:click`; auditioning leaves both channels muted and their channel nodes at 0; zero channel volume silences audition while other channels still sound.
- `isChannelAudible` is false for a muted channel and for a zero-volume channel, and a scheduled stroke on the latter triggers nothing.

**Two pre-existing expectations corrected along the way** (both are the spec-correct reading, not new behaviour):

- `src/audio/__tests__/ChannelMembership.test.ts` — "routes an uploaded click sample through the Click Mixing Channel and obeys its mute" expected a recorded route to omit the node the route starts at, so it failed at `291515f` and `285c6d7`; the expected chain now names the sample gain node first. The routing itself is unchanged: `click-sample-gain → mixer:click → mixer:master → destination`.
- `src/audio/__tests__/AudioGraphWiring.test.ts` — "routes both the built-in click and the built-in drum voices to the audio destination" treated every `click:`-labelled voice as part of the audible Click line. It now asserts the two lines separately: the line voices route through `mixer:click`, and the preview voices `click:audition:*` route through `audition:click` and never through the Click Channel node.

**Checks** — `npx vitest run`: 29 files / 285 tests pass. `npx tsc --noEmit`: clean.

## Comments

- Spec: `.scratch/mixing-channels-mixer-panel/spec.md` (Implementation Decisions 4 and 5, user stories 11, 12, 15). The Audition exception is deliberate and recorded in ADR-0005 — it is not an inconsistency to fix.
