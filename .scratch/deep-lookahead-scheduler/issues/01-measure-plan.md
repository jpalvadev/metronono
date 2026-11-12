# 01: Measure Plan — the tick stops consulting the domain

**What to build:** The transport resolves the reading line into a Measure Plan before playing and at composition edits, and the audio clock tick only reads the pre-bucketed beat of the current plan. A drummer who swaps the reading line, ostinato, system or a formula mid-session hears the new strokes from the next measures on without restarting playback; tempo changes (setTempo, tap, ramp) never trigger a rebuild.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The injected domain engine's public resolveMeasure is called at most once per measure while playing N beats of a repeating line (today: once per beat).
- [ ] Changing the ostinato or system on the domain engine while playing changes the strokes heard in subsequent measures (via the engine's change hook, no scheduler setter).
- [ ] setReadingLine mid-session changes the strokes heard in subsequent measures.
- [ ] Strokes keep landing at the same audio-clock instants as before (time + subOffset × beatDuration), with clicks still muted by mask/dropout and drum strokes not gated by them.
- [ ] The existing mock-transport scheduler suite (timings, gap clicks, ramp, dropout) stays green.
