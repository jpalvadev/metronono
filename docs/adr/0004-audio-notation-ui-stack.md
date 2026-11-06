# 0004. Audio, Notation, and UI Stack: Tone.js, VexFlow 5, and shadcn/ui

We decided to use:
1. **Tone.js** as the audio transport and scheduling engine: It wraps the Web Audio API with battle-tested sample-accurate scheduling (`Tone.Transport`), seamless sample playback and polyphony (`Tone.Players`), and built-in tempo ramping and swing calculations.
2. **VexFlow 5** (TypeScript + Bravura font) as the music engraving engine: It natively supports standard percussion clefs, custom noteheads (crosses for cymbals/hi-hat, ovals for drums), multi-voice stem directions, and responsive SVG/Canvas rendering for both the 1-line Reading View and 5-line Drum Staff View.
3. **shadcn/ui + Tailwind CSS** for UI components: Provides standard, accessible, robust controls (sliders, dialogs, dropdowns, badges, toggles) using the preset `b5dMVCPy4` (Style `lyra`, Theme `teal`, Base `mauve`, Font `Montserrat`).
