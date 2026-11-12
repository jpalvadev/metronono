# Zero-Allocation Tick: Measure Plan and Pooled Audio Voices

The audio clock tick reached the Web Audio destination through three leaks: every custom-sample stroke fabricated a fresh `ToneBufferSource` plus a fresh `Gain` that was never disconnected (thousands of dangling nodes), the monophonic MetalSynth voices cancelled their previous attack on rapid subdivisions, and `resolveMeasure()` — heavy formula expansion, merge and sort — ran inside the tick on every beat, four times per measure. We decided the tick does zero domain math and zero node allocation: the scheduler pre-resolves the reading line into a **Measure Plan** (per-measure, bucketed by beat) at `start()` and rebuilds it only when the composition changes — `setReadingLine`, `setDawsonEngine`, or a `DawsonEngine.onChange` subscription firing on ostinato/system/formula edits. Tempo, ramp, mask and dropout never invalidate the plan (events are tempo-relative `timeInMeasure` offsets; gating stays cheap at the tick). Pooled voices live in the players: drum rigs hold small rings of interchangeable synth instances per voice slot, cycled per stroke, custom-sample strokes reuse one Gain node per voice slot, and the unavoidable fresh `ToneBufferSource` per stroke is retired — stopped and disconnected — once its playback window has elapsed, drained on `stop()` and `dispose()`.

## Amendment: the node budget of the eager graph

Pooled voices turned out to be far more expensive than one node each: a `Tone.MetalSynth` alone costs over a hundred `Gain`/`ConstantSourceNode` instances, so the eager graph of a session is `rigs × slots × ring width × subgraph size`. Doubling the graph (audition rigs built at page load as a second copy of every rig) took a session from 4,673 to 13,049 `createGain` calls at load, and Chrome's WebAudio renderer then refuses to play anything: silence, the console error `The AudioContext encountered an error from the audio device or the WebAudio renderer`, the transport falling behind (6 ticks in 10s at 120 bpm instead of 25 in 12s) and the sight-reading playhead stalling. We decided the eager graph pays for the audible voices only:

- `VOICE_POOL_SIZE = 2` for every voice slot of an audible rig — the narrowest ring that still gives a stroke its own live attack, so no slot is wider for long-decay cymbals.
- `AUDITION_POOL_SIZE = 1`: an Audition rig is heard only at a tap gesture, so one member per slot holds it.
- Only the audible mix rigs are built at page load; an Audition rig earns its nodes at the audition gesture (`ensureRig`) and stays for later taps.

Measured at the browser seam this keeps load gains at 4,673 (the pre-candidate baseline), the beat cadence at ~0.5s at 120 bpm, and no renderer or scheduling-time console error. The retirement that runs inside a scheduled callback names the scheduling time it stops at (`stop(now)` when finite) — Tone v15's `assertUsedScheduleTime` warns otherwise ("Events scheduled inside of scheduled callbacks should use the passed in scheduling time"), a misuse the jsdom suites could not see because the fake source recorded `stoppedAt = fakeClock.time` indistinguishably.

## Considered Options

- **Per-beat resolve with per-stroke node spawning** (status quo): rejected — main-thread jitter at fast tempos and unbounded graph growth.
- **`Tone.PolySynth` for the drum voices**: rejected — one voice per pitch only, but our rigs already model distinct timbres per voice and ring cycling keeps each voice's exact envelope.
- **Recycling `ToneBufferSource` like synths**: impossible — a Web Audio `BufferSourceNode` can only `start()` once; only its gain wrapper is poolable.
- **Async lookahead worker that resolves the next measure off-tick**: rejected for now — a synchronous plan rebuilt on composition edits already keeps the tick free of domain math; an async worker adds a race between edit and plan without a proven need.

## Consequences

- Extends ADR-0005 (single eagerly built graph): the graph grows slightly (voice rings build once, never per stroke); ADR-0005's rule that accessors return wired objects still holds.
- Mutes and dropout still gate only clicks, never drum strokes — the plan must not bake gating in.
- fakeTone suites can now assert the discipline directly: stable node counts across ticks, `resolveMeasure` called once per measure rather than per beat, retirement visible as `stoppedAt`/`disposed` on recorded buffer sources, and the accurate-timing misuse as `stoppedWithoutScheduleTime`.
- The node budget, the beat cadence and the WebAudio renderer error are invisible to jsdom: `npm run check:live` (`scripts/live-audio-guard.mjs`) drives a real Chromium and asserts gains at page load, delivered beats against the configured tempo, sources started per beat, and a clean console. It is RED on a doubled eager graph (13,049 gains, 3 beats in 6s at 120 bpm) and GREEN on the budget above.
