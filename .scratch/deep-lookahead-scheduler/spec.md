# Spec: Deepen the Lookahead Scheduler — Measure Plan & Audio Voice Lifecycle

**Status:** ready-for-agent

## Problem Statement

Practicing with the metronome at fast tempos, the sound stutters ("el sonido se traba"). Long sessions of custom sample playback gradually degrade audio. Fast subdivisions on cymbal voices (ride, crash, hi-hat) sound choked — consecutive hits cancel each other — and the beat callbacks that feed the playhead jitter because the domain formula resolution (sort, filter, merge) runs synchronously inside every beat of the audio clock tick.

## Solution

Deepen the Lookahead Scheduler inside the transport: the audio clock tick becomes zero-allocation and free of domain math. Before playback the reading line is resolved once into a Measure Plan — per-measure Scheduled Drum Events bucketed by beat — and the tick just reads the next bucket and submits strokes. Drum rigs hold an Audio Voice Pool: rings of interchangeable synth instances per voice slot so rapid strokes never cancel a live attack, and one reusable Gain node per custom-sample voice instead of a fresh node per stroke, with every stroke's unavoidable fresh BufferSource retired (stopped and disconnected) once its playback window has elapsed.

## User Stories

1. As a drummer, I want playback at fast tempos (up to 300 bpm) to sound steady, so that I can practice rudiments without the click track stuttering.
2. As a drummer, I want gap clicks and drum strokes to land on the exact audio-clock instants they already do today, so that deepening the scheduler changes no timing semantics.
3. As a drummer, I want consecutive fast strokes on the hi-hat, ride or crash to each sound fully, so that rapid 16th and 32nd figures stop cancelling the previous attack on a monophonic voice.
4. As a drummer, I want the ostinato and orchestration voices to keep their exact timbres, so that fixing the choke does not homogenize the kit.
5. As a drummer, I want the domain formula resolution to happen once per measure before the tick, so that the playhead callbacks never jitter behind heavy sort-and-merge work.
6. As a drummer, I want tempo changes mid-session (setTempo, tap, ramp) to keep playing without any rebuild, so that tempo stays a cheap tick-time concern.
7. As a drummer, when I swap the reading line mid-session, I want the new line's strokes heard from the next measures on, so that the Measure Plan follows my edit immediately.
8. As a drummer, when I change the ostinato or the interpretation system while playing, I want the new strokes heard without restarting, so that the composition edit invalidates the plan like today's per-beat resolve did.
9. As a drummer, I want a muted beat's click silenced but its drum strokes still heard (dropout likewise), so that gating semantics keep living at the tick, not baked in the plan.
10. As a drummer with custom samples, I want long sessions to keep the audio graph bounded, so that hours of practice don't accumulate thousands of dangling gain nodes.
11. As a drummer, I want each custom-sample stroke still audible at its own velocity, so that pooling the gain node keeps per-stroke dynamics.
12. As a drummer, I want finished sample strokes disconnected from the graph once they can no longer be heard, so that "retired" is an automatic lifecycle, not a leak.
13. As a drummer, I want stopping or disposing the transport to leave nothing feeding the audio destination, so that teardown still disconnects the whole graph including pooled and retired voices.
14. As a drummer, I want Audition previews to keep bypassing Mixing Channel mutes, so that pooling did not touch the deliberate exception of ADR-0005.
15. As a returning user, I want the eager single graph contract (ADR-0005) untouched — accessors only ever return wired objects — so that the deepening changes no construction rules.

## Implementation Decisions

- The deepening is internal to the transport: the scheduler's public interface stays the same (start/stop/setReadingLine/setDawsonEngine/tempo/accessors). No new public seam is introduced; the Measure Plan and voice rings are internals of the deep module, per DEEPENING's in-process category.
- Measure Plan: built at start() (and rebuilt lazily if the graph was not ready), one plan per reading-line measure (default whole-rest measure when no line), each plan bucketed by whole beat index. The tick consults only the bucket for the beat that arrived — never resolveMeasure, never a filter. Measure cycling is by plan length.
- Plan invalidation: setReadingLine and setDawsonEngine rebuild-on-next-use; the scheduler subscribes to the domain engine's change hook (onChange) so ostinato/system/formula edits invalidate. Tempo, ramp, beat mask, dropout never invalidate.
- Voice lifecycle in the drum kit player: each rig voice slot becomes a small ring of same-kind synths (2 per slot; 3 for the long-decay MetalSynths) cycled per stroke; rings share their slot label. Rings only change the rig's internal shape; the player's play/triggerVoice interface does not move.
- Custom-sample strokes (drum kit and click player): one pooled Gain per voice slot per lane/mode instead of a fresh Gain per stroke; velocity written as a timed gain write per stroke; each stroke's fresh BufferSource is registered as pending and retired — stopped and disconnected — when its playback window has ended, checked on each tick and drained on stop()/dispose().
- What must not change: timing of every stroke (time + subOffset × beatDuration), click muting rules, Audition bypass, the eager graph contract, Mixing Channel wiring, channel volumes.
- The clock tick must allocate nothing per beat: no new synths, no new gains, no array churn beyond reading buckets.

## Testing Decisions

- Seams (pre-agreed, existing — no new seams): (a) ToneTransportScheduler driven by the recording fake Tone harness — fakeTone's FakeTransport.fireRepeats advances real beats and the suite observes through the recorder (node kinds and labels, trigger records, gain writes, stoppedAt/disposed on buffer sources). (b) DrumKitPlayer and ToneClickPlayer suites over fakeTone for ring cycling, pooled gains and retirement. (c) The existing mock-transport scheduler suite stays green: timing and gating semantics are a behavioral contract, not a rewrite target.
- Good tests assert external behavior only: strokes heard at the right audio times, one domain resolve per measure rather than per beat (observed via the public resolveMeasure interface of an injected engine recording its call count), stable node-kind counts across many ticks, every recorded buffer source eventually stopped+disposed, destination inputs at teardown zero.
- Prior art: `AudioGraphWiring.test.ts` (fakeTone vi.mock pattern, label lookup, routeTo destination), `ToneTransportScheduler.test.ts` (fireRepeats-style tick driving), `DrumKitPlayer.test.ts`.

## Out of Scope

- Real AudioContext/Playwright audio profiling: Web Audio gives no readout of the internal graph; fakeTone is the observation proxy.
- Click synth voices rings (envelope releases are far shorter than any gap-click interval), BackgroundAudioService, mixer state persistence (PENDING item 8), storage adapter changes.
- Notation rendering (candidates 2 and 3), continuous metric timeline in the formula canvas.

## Further Notes

- ADR-0011 (Zero-Allocation Tick: Measure Plan and Pooled Audio Voices) records the decisions; it extends ADR-0005, which still owns eager graph construction and the fakeTone test policy.
- Glossary adds Measure Plan and Audio Voice Pool; use that vocabulary in tests and names.
