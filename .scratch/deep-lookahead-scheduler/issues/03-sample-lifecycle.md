# 03: Sample stroke lifecycle — pooled gains, retired buffer sources

**What to build:** Custom-sample playback stops leaking: the click voices and the drum kit hold one pooled Gain node per sample voice slot instead of a fresh Gain per stroke, velocity is written per stroke as a timed gain write, and every stroke's fresh BufferSource is retired — stopped and disconnected — once its playback window has elapsed (checked on each tick), with pending sources drained on stop() and dispose().

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Across N sample strokes the Gain-node kind count stays constant (one per voice slot per lane/mode), not N.
- [x] Each stroke's velocity is observable as its own gain write record, so dynamics survive pooling.
- [x] Every recorded BufferSource ends up stopped and disposed once its playback window elapsed (after enough fired ticks), and the click player's sample gains disconnect on dispose.
- [x] stop()/dispose() leaves no pending sample sources feeding the graph (destination teardown assertion holds).
- [x] Audition previews of sample voices still sound through the Audition node while the Mixing Channel is muted (pooling does not merge the two gain identities).
