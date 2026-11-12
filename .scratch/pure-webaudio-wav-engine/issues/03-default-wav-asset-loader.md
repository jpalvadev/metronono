# 03: Default `.wav` asset loader (`public/samples/<voiceId>.wav`) & Sample Bank WAV alignment

**What to build:** Load and decode default `.wav` assets once per voice from `public/samples/<voiceId>.wav` for all 15 voices (12 drum voices + 3 metronome click voices), prioritizing Sample Bank custom `.wav` overrides, staying silent with a console warning when a `.wav` is missing (zero synthesized fallback, `.mp3` rejected for defaults), and aligning the Sample Bank upload picker to `.wav`.

**Blocked by:** 02-pure-webaudio-mixer-and-sample-player

**Status:** ready-for-agent

- [ ] Default `.wav` assets for all 15 canonical voices load and decode once into cached `AudioBuffer` instances from `public/samples/<voiceId>.wav`.
- [ ] Missing or unreadable `.wav` files log a single warning and leave the voice silent with zero synthesized fallback.
- [ ] Custom `.wav` overrides in Sample Bank take precedence over default `public/samples/<voiceId>.wav` buffers, and resetting restores the default `.wav` buffer.
- [ ] Sample Bank upload input restricts selection to `.wav` files (`accept=".wav,audio/wav"`).
- [ ] `npm run check` passes cleanly.
