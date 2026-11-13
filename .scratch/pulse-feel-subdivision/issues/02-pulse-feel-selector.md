# 02: Pulse Feel Selector (Straight 2×8th vs. Triplet 3×8th)

**What to build:** Add a Pulse Feel selector (`Straight (2×8th)` vs. `Triplet (3×8th)`) alongside the time signature Numerator and Denominator controls so the drummer can switch between quarter-note (`1.0` quarter) and dotted-quarter (`1.5` quarters) pulses while keeping BPM anchored to quarter notes per minute (`quarter-note = BPM`).

**Blocked by:** 01: Quarter-Note Pulse Grid & Odd-Meter Wrapping

**Status:** done

- [x] Metronome engine supports `pulseFeel` (`'straight'` = 2 eighth notes / `1.0` quarter, `'triplet'` = 3 eighth notes / `1.5` quarters; default `'straight'`), recalculating `pulsesPerMeasure`, pulse durations, and `beatMask` preservation on change
- [x] Transport scheduler updates pulse timing (`1.5 * (60 / bpm)` per full pulse in Triplet feel, with fractional remainder wrapping and Gap Clicks clipping) and reschedules immediately when `pulseFeel` changes during playback
- [x] Non-destructive `4/4` exercise gate remains active only for `4/4` Straight (`beats === 4 && beatUnit === 4 && pulseFeel === 'straight'`), suspending Reading View, Ostinato, and Dawson orchestration when Triplet feel is selected
- [x] Metronome UI displays the Straight (`2×8th`) / Triplet (`3×8th`) selector next to the Numerator and Denominator controls and updates beat buttons dynamically (`6/8` Straight → 3 buttons, `6/8` Triplet → 2 buttons, `12/8` Triplet → 4 buttons, `15/16` Triplet → 3 buttons)
- [x] Engine, scheduler, and UI tests verify Triplet feel timing, immediate rescheduling, `4/4` gate behavior, and UI button counts
