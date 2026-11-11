# 0003. Dual-View Notation Architecture: Reading View vs Drum Staff View

> **Status**: Superseded by [0009-single-reading-view-and-removal-of-drum-staff.md](./0009-single-reading-view-and-removal-of-drum-staff.md).

We decided to decouple notation rendering into two dedicated views:
1. **Reading View (1 line)**: A minimalist rhythmic line representing short notes, long notes, ties, and rests (Ted Reed style) for sight-reading practice where the drummer performs mental orchestration over an ostinato.
2. **Drum Staff View (5 lines, PAS standard)**: A full drum kit percussion score using standard heights and noteheads (crosses for cymbals/hi-hat, regular heads for snare/kick/toms) for editing, composing, and hearing the concrete physical orchestration.

This resolves the tension between abstract sight-reading training (Alan Dawson method) and concrete drum transcription/composition without compromising either workflow.
