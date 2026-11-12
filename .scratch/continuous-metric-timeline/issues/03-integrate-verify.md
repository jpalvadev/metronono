# 03: Integrate & verify — mixed figures edit without collision, end to end

**What to build:** Prove the deepening through the component seams: a measure mixing swing triplets (1/3) and straight 16ths (0.25) is edited (click stamp + drag) without losing events, and the editor's committed strokes equal what the audio would schedule (same offsets). Screenshot the running app's partiture editor with the mixed figure for the visual gestalt (hover wash + hitboxes on rendered noteheads).

**Blocked by:** 01 (Canvas speaks continuous events), 02 (Editor slot bar becomes a quantized display strip).

**Status:** done

- [x] New e2e pin: mixed 1/3 + 1/4 figure through the canvas — drag moves the ride event to the 0.5 position, both 1/3 durations and the 0.25 survive (no re-quantization, no collision); click stamp merges at the fractional 2/3 event.
- [x] App screenshot (.scratch/continuous-metric-timeline-candidate3.png): Jazz Swing ostinato staff (four triplet [3] brackets, ride stems, hi-hat-foot X below the stave) fully inside the grown viewport; partiture editors render with their grid guides and playhead intact — ADR-0012 headroom composes with the ADR-0013 continuous input.
- [x] Full npm run check green on the integration branch (style sweep, tsc, whole vitest suite — hook-verified on every commit).
