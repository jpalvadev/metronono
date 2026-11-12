# Zero-Allocation Tick: Measure Plan and Pooled Audio Voices

The audio clock tick reached the Web Audio destination through three leaks: every custom-sample stroke fabricated a fresh `ToneBufferSource` plus a fresh `Gain` that was never disconnected (thousands of dangling nodes), the monophonic MetalSynth voices cancelled their previous attack on rapid subdivisions, and `resolveMeasure()` — heavy formula expansion, merge and sort — ran inside the tick on every beat, four times per measure. We decided the tick does zero domain math and zero node allocation: the scheduler pre-resolves the reading line into a **Measure Plan** (per-measure, bucketed by beat) at `start()` and rebuilds it only when the composition changes — `setReadingLine`, `setDawsonEngine`, or a `DawsonEngine.onChange` subscription firing on ostinato/system/formula edits. Tempo, ramp, mask and dropout never invalidate the plan (events are tempo-relative `timeInMeasure` offsets; gating stays cheap at the tick). Pooled voices live in the players: drum rigs hold small rings of interchangeable synth instances per voice slot (2, 3 for the long-decay MetalSynths) cycled per stroke, custom-sample strokes reuse one Gain node per voice slot, and the unavoidable fresh `ToneBufferSource` per stroke is retired — stopped and disconnected — once its playback window has elapsed, drained on `stop()` and `dispose()`.

## Considered Options

- **Per-beat resolve with per-stroke node spawning** (status quo): rejected — main-thread jitter at fast tempos and unbounded graph growth.
- **`Tone.PolySynth` for the drum voices**: rejected — one voice per pitch only, but our rigs already model distinct timbres per voice and ring cycling keeps each voice's exact envelope.
- **Recycling `ToneBufferSource` like synths**: impossible — a Web Audio `BufferSourceNode` can only `start()` once; only its gain wrapper is poolable.
- **Async lookahead worker that resolves the next measure off-tick**: rejected for now — a synchronous plan rebuilt on composition edits already keeps the tick free of domain math; an async worker adds a race between edit and plan without a proven need.

## Consequences

- Extends ADR-0005 (single eagerly built graph): the graph grows slightly (voice rings build once, never per stroke); ADR-0005's rule that accessors return wired objects still holds.
- Mutes and dropout still gate only clicks, never drum strokes — the plan must not bake gating in.
- fakeTone suites can now assert the discipline directly: stable node counts across ticks, `resolveMeasure` called once per measure rather than per beat, retirement visible as `stoppedAt`/`disposed` on recorded buffer sources.
