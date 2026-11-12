# 04: Integrate & verify — the zero-allocation tick holds end to end

**What to build:** A fake Tone suite that plays a full practice session — reading line with triplets mixed with straight figures, ostinato active, a custom sample voice loaded, tempo ramp sweeping — and asserts the discipline through the transport interface alone: bounded node creation across 16+ fired beats, exactly one resolveMeasure per cycled measure, every stroke triggered at its audio time, every sample source retired, nothing feeding the destination after dispose.

**Blocked by:** 01 (Measure Plan), 02 (Voice Pool), 03 (Sample lifecycle).

**Status:** done

- [x] Session suite green: node-kind counts bounded, resolve count per measure, retirement complete, teardown clean.
- [x] Full npm run check green on the integration branch (style sweep, tsc, whole vitest suite).
