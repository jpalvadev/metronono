- 1 [ x ] each mixing channel (click, ostinato, orchestration) must be independently audible or silent, so the metronome can be played alone without the sight reading / alan dawson drum audio, and viceversa. Spec: .scratch/mixing-channels-mixer-panel/spec.md (root cause found: the channel gain nodes and the built-in drum synths are never created, so the 3 sliders and mutes do nothing). Done on branch feat/mixing-channels-mixer-panel, tickets 01-06 in .scratch/mixing-channels-mixer-panel/issues/; the Mixer Panel now holds the only loudness controls, and the root cause is fixed by the eager channel graph in ticket 02.

- 2 [ x ] the partiture should have a dividing bar betweeen measures. (root cause: VexFlow's built-in stave barlines collapse to 1px rects on a one-line stave; ReadingScoreRenderer now suppresses them via leftBar/rightBar and draws full-height dividing + final barlines explicitly; 5-line DrumStaffRenderer barlines were already fine)

- 4 [ x ] apply the correct shadcn style https://ui.shadcn.com/create?preset=b5dMVCPy4&template=vite (root cause: preset b5dMVCPy4 specifies Lyra style with mauve base and teal theme; app previously lacked the dark mode root class, exact sampled mauve charcoal `#1a171e` and canvas `#0c070d` tokens, Lyra sharp `rounded-none` edges on cards, buttons, badges, and square slider thumbs, as well as the dense modular dashboard grid. Fixed by installing preset tokens, converting all component cards, buttons, and dialogs to sharp Lyra styling, tuning slider thumbs to square 12px white blocks on thin tracks, applying inverted dark score rendering, and structuring the layout into high-density modular side-by-side cards matching the user reference capture)

- 5 [ x ] config github

- 6 [ x ] fix 8 notes stems, its shows up and down, stems always go up (root cause: Beam.generateBeams auto-computes the beam/stem direction from the notes' key line, and b/4 on the one-line stave reads as below-center, so it setStemDirection(DOWN) over the beamed groups' own stems while single short notes stayed up; ReadingScoreRenderer now forces { stemDirection: Stem.UP } at both generateBeams call sites, and the guard tests assert every vf-stem path in the rendered SVG stays above the stave line)

- 7 [ x ] subdivision (gap) clicks are configurable and auditionable but never scheduled: ToneClickPlayer.playSubdivision is only reached from auditionVoice, so a click_subdivision sample can never be heard during playback (root cause: scheduleTicks only ever called play() for the beat click, never playSubdivision. Fixed by scheduling gap clicks on the audio clock: MetronomeEngine's subdivision voice gained a divisions count (1 = no gap clicks, default), ToneTransportScheduler splits each unmuted beat at time + (gap/divisions)*beatDuration through the subdivision voice, and the Click Sounds panel gained a Gap Clicks selector None/2×/3×/4×)

- 8 [ ] mixer state (mixing channel volumes, mutes, and the practice preset) should persist across sessions; StorageAdapter stores only scores, systems and samples today

- 9 [ ] the components are arrenged badly. The metronome should live inside the main container, as a module

- 10 [ x ] the formula composer, instead of selecting the note value, the sound, etc, it should be a partiture editor, where i should select the not value, if its a rest, if its an accent, or ghost, etc. and in a partiture i could place the note whenever I want to select the sound source. Spec: .scratch/partiture-formula-editor/spec.md (root cause: replaced legacy card/dropdown form with interactive 5-line PAS PartitureFormulaEditor supporting polyphonic unisons, rests, and drag-and-drop)

- 11 [ ] playhead overlay has a style discrepancy with the notation: the teal cursor, locator diamond, and measure-highlight box are sized from the raw stave box (staveHeight 80 at staveY) instead of the rendered music block (barline extent from beam tops to notehead bottoms), so they tower over and misalign with the system

- 12 [ x ] after the audio-transport and partiture merges the live app broke: no audio/no click at all, the TED Reed sight line started and stopped, and the clock ran far slower than the configured tempo (console: `The AudioContext encountered an error from the audio device or the WebAudio renderer`, `Events scheduled inside of scheduled callbacks should use the passed in scheduling time`) (root cause: the voice-pool rewrite doubled the eager graph — audition rigs built at page load plus 3-member cymbal rings — so a session paid 13,049 `createGain` at load instead of 4,673, Chrome's WebAudio renderer refused to play and the Tone transport fell behind (3 beats in 6s at 120 bpm). Fixed per the ADR-0011 node-budget amendment: `VOICE_POOL_SIZE = 2` everywhere, `AUDITION_POOL_SIZE = 1`, only the audible mix rigs built eagerly, an Audition rig earned at its tap gesture via `ensureRig`, and sample retirement naming the scheduling time (`stop(now)`). The jsdom suites stayed green because the fake source hid the misuse; `src/test/fakeTone.ts` now records `stoppedWithoutScheduleTime` and `npm run check:live` (scripts/live-audio-guard.mjs) guards the real browser seam)

- 13 [ ] the browser-seam audio guard does not reach the custom Sample Bank path, so two legs of item 12 are still unverified where they were reported: the accurate-timing `stop(now)` contract is pinned only at the fake-Tone seam (the headless browser's IndexedDB bank is empty, so no sample voice ever retires there), and the guard only asserts that sources `start` per beat, never that they are heard (the sibling root cause in item 1 was channel gain nodes never being created, which starts nothing yet also passes a count-only check). Next step: seed a recorded sample into the browser session and assert the retirement time plus audibility (channel gains wired, mixer unmuted) from the WebAudio graph 

- 14 [ x ] the dropout mode should have a selector for how many measures with all tempo clicks (number), and another selector (number) with how many measures with silence in all tempos, this 2 selectors should be above the slider of chance of silence.

- 15 [ x ] there should be a time signature selector, not 4/4 and 3/4 only like today. I should be able to select time signatures like 7/8, 15/16, etc, 21/16, 6/4, 5/8, 10/16, 5/4, etc. The buttons of All, 2 & 4 (Jazz) 1 & 3 and 1 Only should be gone, and all mentions to it. 

- 16 [ x ] I dont want horizontal or vertical scroll bars on the syncopation page, there should not be a vertical size limit, and horizontal scroll bar i think is a CSS bug or mistake. Also, as the width of the window shrink, the bars per row should dimishish, from 4 to 3, 2 and one, for cell phones. And the number of bars generated should reach 32, 48 and 64 add those new options (removed Reading View `max-h-[460px]` and internal scrollbars, dropped 300px/200px width floors so narrow mobile containers fit without overflow, added progressive 4→3→2→1 breakpoints with width-clamped `Auto | 1 | 2 | 3 | 4` selector, expanded Procedural Generator bar counts to 4/8/16/32/48/64, and added window-level `Auto-scroll` toggle that starts OFF and disengages on manual scroll)

- 17 [ x ] on the main Alan Dawson Orchestration view there should not be an edit button, this is not the view for editing ostinatos or formulas. This function should be done only in the modal that opens with the button Manage Systems, Formulas & Ostinatos (removed the Ostinato, Short Formula, and Long Formula Edit buttons and FormulaEditorDialog wiring from DawsonOrchestrationSection; editing remains exclusively inside PresetManager opened via "Manage Systems, Formulas & Ostinatos")

- 18 [ x ] The tempo ramp up functionality should have a start bpm and a target bpm, and a checkbox if the tempo stays on the target BPM or if it goes up and down between both BPMS (added explicit Start BPM input, bidirectional linear interpolation, Oscillate Start ↔ Target checkbox with symmetric triangle-wave oscillation and direction/progress readout, manual BPM control lock while active, pre-ramp BPM snapshot/restore on disable, and full metronome reset to measure 0 beat 0 on live ramp parameter edits)

- 19 [ x ] Delete from the main Alan Dawnson Orchestration the Button "Audition" from the Ostinato, and from the formulas, they are not needed here. (removed Ostinato, Short Formula, and Long Formula Audition buttons, handlers, and unused stroke offset helpers from DawsonOrchestrationSection; auditioning remains available inside PresetManager modal)

- 20 [ x ] the user should be able to select how the notes on the single line reading sound, if they are straight eights or swung eights. To undestand better I present you an example. Imagine you are playing a jazz swing ostinato, and the swung eights should align withg the last eight triplet, but since all notes from the single line reading training are straight eights, its sounds bad. Do you get what I am saying? (added Reading Feel setting with Straight vs Swung Eighths interpretation in 4/4; transforms upbeat eighth notes to beat + 2/3 locking in with the Jazz Swing ride ostinato while preserving standard 4/4 notation with a Swing ♫ = ♩♪ header badge and nominal stroke durations)

- 21 [ x ] I think the System concept (a conjugation of ostinatos and formulas) should not exists, it brings complexity or a concept that does not bring too much to the table, the user can select the ostinato and the interpretation system on the fly on the main Alan Dawson Orchestration view. We should delete every mention and functionlity of the "System", unless you say otherwise and see value on this concept. Also, on the modal view, when we select the formula tab there is the following error:
PresetManager.tsx:720 Uncaught TypeError: Cannot read properties of undefined (reading 'map') (clarified during grilling: DawsonSystem already pairs Short + Long formulas independently from Ostinatos, so System was kept untouched; fixed the Formula tab crash in PresetManager.tsx via defensive `formatStrokeLabel` guarding missing/empty `hits`, and added `normalizeStrokes`/`normalizeFormula` in `DawsonPresetManager.loadFromStorage` so legacy/stored strokes without `hits` normalize to rests)
    at PresetManager.tsx:720:61
    at Array.map (<anonymous>)
    at PresetManager.tsx:715:46
    at Array.map (<anonymous>)
    at PresetManager (PresetManager.tsx:687:35)

PresetManager.tsx:720 Uncaught TypeError: Cannot read properties of undefined (reading 'map')
    at PresetManager.tsx:720:61
    at Array.map (<anonymous>)
    at PresetManager.tsx:715:46
    at Array.map (<anonymous>)
    at PresetManager (PresetManager.tsx:687:35)
installHook.js:1 The above error occurred in the <PresetManager> component:

    at PresetManager (http://localhost:5173/src/components/dawson/PresetManager.tsx:40:3)
    at div
    at DawsonOrchestrationSection (http://localhost:5173/src/components/DawsonOrchestrationSection.tsx:35:3)
    at div
    at div
    at main
    at App (http://localhost:5173/src/App.tsx?t=1794538153877:31:26)

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
chunk-FD5SMSK5.js?v=91c603c5:9176 Uncaught TypeError: Cannot read properties of undefined (reading 'map')
    at PresetManager.tsx:720:61
    at Array.map (<anonymous>)
    at PresetManager.tsx:715:46
    at Array.map (<anonymous>)
    at PresetManager (PresetManager.tsx:687:35)