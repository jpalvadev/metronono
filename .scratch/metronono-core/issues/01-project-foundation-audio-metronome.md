# 01: Project Foundation & Audio Click Metronome

**What to build:** The foundational web application shell with an interactive, sample-accurate audio metronome. Users can start and stop the metronome, adjust the tempo using a continuous BPM slider or tap tempo, choose time signatures (such as 4/4 and 3/4), and hear precise click sounds scheduled on the hardware clock without jitter.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Vite + React + TypeScript + Tailwind CSS and shadcn/ui application initializes cleanly with preset `b5dMVCPy4` (Lyra style, Teal theme, Mauve base, Montserrat font)
- [ ] Tone.js audio context initializes with sample-accurate scheduling via hardware clock
- [ ] Play and Stop button controls metronome playback state with visual feedback
- [ ] BPM control allows adjusting tempo from 30 to 300 BPM via slider and numeric input
- [ ] Tap tempo button computes and updates the BPM based on user tap intervals
- [ ] Time signature selector supports common meters (4/4, 3/4) with distinctive downbeat click
- [ ] Master volume slider controls metronome audio output level
- [ ] Unit tests verify time signature metric calculations and tempo state management
