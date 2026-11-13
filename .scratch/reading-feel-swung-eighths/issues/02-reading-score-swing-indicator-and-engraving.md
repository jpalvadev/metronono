# 02: Reading Score Swing Indicator and Engraving Preservation

**What to build:** Update `ReadingScoreRenderer` to accept `readingFeel?: ReadingFeel` in its render options. When `readingFeel === 'swing'`, render a clear `Swing (♫ = ♩♪)` indicator above the stave while preserving the original Ted Reed 4/4 notation (straight eighth notes and rests are not rewritten into triplets). When `readingFeel === 'straight'` (or omitted), no swing indicator is drawn.

**Blocked by:** 01: Swung Eighths Audio Timing and Measure Plan

**Status:** ready-for-agent

- [ ] `ReadingScoreRenderer.render` accepts `readingFeel?: ReadingFeel` in `ReadingScoreOptions`.
- [ ] Visual notation remains standard 4/4 with normal eighth notes, rests, beams, and barlines (no conversion of note shapes into triplet notation).
- [ ] When `readingFeel === 'swing'`, render the `Swing (♫ = ♩♪)` indicator on the score SVG (or container header).
- [ ] When `readingFeel === 'straight'`, omit the swing indicator.
- [ ] Guard tests verify that stave height, note coordinates, and beam structures are unchanged between straight and swing modes, and assert the presence/absence of the swing indicator text element.
