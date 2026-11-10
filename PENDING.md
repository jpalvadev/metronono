- 1 [ x ] each mixing channel (click, ostinato, orchestration) must be independently audible or silent, so the metronome can be played alone without the sight reading / alan dawson drum audio, and viceversa. Spec: .scratch/mixing-channels-mixer-panel/spec.md (root cause found: the channel gain nodes and the built-in drum synths are never created, so the 3 sliders and mutes do nothing). Done on branch feat/mixing-channels-mixer-panel, tickets 01-06 in .scratch/mixing-channels-mixer-panel/issues/; the Mixer Panel now holds the only loudness controls, and the root cause is fixed by the eager channel graph in ticket 02.

- 2 [ x ] the partiture should have a dividing bar betweeen measures. (root cause: VexFlow's built-in stave barlines collapse to 1px rects on a one-line stave; ReadingScoreRenderer now suppresses them via leftBar/rightBar and draws full-height dividing + final barlines explicitly; 5-line DrumStaffRenderer barlines were already fine)

- 3 [ ] ramp option should have 2 inputs, beginning and end tempo, and option if it should be up and down (or down and up) and if it should end the metronome or loop

- 4 [ ] apply the correct shadcn style https://ui.shadcn.com/create?preset=b5dMVCPy4&template=vite

- 5 [ x ] config github

- 6 [ ] fix 8 notes stems, its shows up and down, stems always go up

- 7 [ ] subdivision (gap) clicks are configurable and auditionable but never scheduled: ToneClickPlayer.playSubdivision is only reached from auditionVoice, so a click_subdivision sample can never be heard during playback

- 8 [ ] mixer state (mixing channel volumes, mutes, and the practice preset) should persist across sessions; StorageAdapter stores only scores, systems and samples today
