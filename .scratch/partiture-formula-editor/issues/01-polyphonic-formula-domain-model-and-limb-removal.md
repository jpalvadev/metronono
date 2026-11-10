# 01: Polyphonic formula domain model and limb removal

**What to build:** The domain model and scheduling engine support subdivision formulas with chords of simultaneous drum hits (e.g. Bass Drum and Crash Cymbal struck together on an accented downbeat) and explicit silent rests, while the unused limb concept is retired across the entire codebase. Built-in default formulas are updated to the chord structure and schedule simultaneously sounding strokes through the audio transport without timing drift or jitter.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The `Limb` type (`'R' | 'L' | 'RF' | 'LF'`) and all limb tracking logic are removed from the domain layer, audio scheduling, and preset management.
- [x] Formula strokes represent chords and rests via `OrchestratedStroke` with duration, an optional rest indicator, and an array of drum hits:
```typescript
export interface DrumHit {
  voice: DrumVoice;
  dynamic: Dynamic;
}

export interface OrchestratedStroke {
  durationRatio: number;
  isRest?: boolean;
  hits: DrumHit[];
}
```
- [x] Built-in default short and long formulas are updated to the chord schema, correctly reflecting their rhythmic phrasing without limb fields.
- [x] Scheduling an orchestration measure creates simultaneous audio events for all voices within a chord at the exact same metric timestamp.
- [x] Scheduling an orchestration measure advances the metric offset across rests without producing audible events or drum pad triggers.
- [x] Math and offset resolution utilities correctly compute cumulative formula duration and start offsets across multi-hit chords and rests.
- [x] Automated domain and scheduling engine tests verify simultaneous unisons, rest advancement, and formula duration calculation.

## Answer

The polyphonic formula domain model and limb removal are fully implemented:
1. `Limb` type and limb tracking logic removed from domain types, scheduling, preset management, and UI.
2. `OrchestratedStroke` generalizes strokes to support `isRest?: boolean` and `hits: DrumHit[]`.
3. Built-in default formulas (`DEFAULT_SHORT_FORMULAS`, `DEFAULT_LONG_FORMULAS`, `DEFAULT_DAWSON_SYSTEMS`) updated to the polyphonic chord schema.
4. `DawsonEngine.resolveOrchestrationEvents()` schedules simultaneous unison events at identical `timeInMeasure` timestamps for multi-hit chords and skips rests while advancing the metric clock.
5. All domain, scheduling, and UI tests pass.
