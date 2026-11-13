# 01: Quarter-Note Pulse Grid & Odd-Meter Wrapping

**What to build:** Anchor the Metronome's default pulse to the quarter note (`quarter-note = BPM`) across all `N/D` time signatures so odd/compound meters show quarter-note pulse buttons (`15/16` → 4 buttons, `7/8` → 4, `21/16` → 6, `6/8` → 3), fire clicks on the quarter-note grid (`60 / bpm`), wrap each bar at its exact `N/D` duration (truncating the final fractional pulse), and clip any Gap Clicks that would fall on or past the measure boundary.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Metronome engine computes `pulsesPerMeasure` as `ceil(measureQuarters / pulseQuarters)` and tracks each pulse's actual duration (clamped to the remaining measure length on the final pulse), resizing `beatMask` to the pulse count while preserving existing mutes
- [x] Lookahead transport and scheduler advance each pulse by its actual duration in seconds (`actualPulseQuarters * (60 / bpm)`) so `15/16` wraps after 3 sixteenth notes on beat 4 (`4 + 4 + 4 + 3`) and `7/8` wraps after 1 eighth note on beat 4 (`2 + 2 + 2 + 1`)
- [x] Gap Clicks subdivide the nominal pulse duration (`pulseQuarters * (60 / bpm)`) and suppress any gap click whose offset is `>=` the current pulse's actual remaining measure duration
- [x] Metronome UI renders one beat button per computed pulse (e.g., 4 buttons for `15/16` and `7/8`, 6 for `21/16`, 3 for `6/8`) with per-pulse click-to-mute working across all meters
- [x] Engine, scheduler/lookahead, and Metronome UI tests verify pulse counts, exact audio-clock wrap timestamps, Gap Clicks clipping, and beat-button counts
