# Coding Standards

Read during review (`/code-review` Standards axis). Each rule is labelled hard or judgement call.

## Notation renderers (judgement call)

A renderer test must assert against the rendered SVG DOM (barlines, noteheads, clefs) for behaviour the user sees — not only the returned `ScoreLayout` object. Layout assertions alone pass while the canvas stays blank or degenerate (e.g. VexFlow stave barlines collapse to invisible 1px rects on a 1-line stave).

Pin geometry, not counts: DOM assertions must compare coordinates or relationships (a stem tip's y against the stave line), never node existence or counts alone — a count-only check passes while the canvas renders inverted (VexFlow's auto beam direction flips short-note stems to stem-down on a one-line stave, where every stem should point up).

Keep engraving geometry (spacing, stem reach, beam thickness, clearances) as module-level named consts in the renderer, not inline literals — tests import them to assert real coordinates, and a test that re-types a literal drifts silently from the code it checks.

**Drum notation voice unification (hard rule)**: All simultaneous drum kit strokes (cymbals, snare, toms, kick, and hi-hat foot) in the formula and ostinato editors must be rendered as unified chord notes on a single voice (`voice1Notes`) with `Stem.UP`. Never introduce Voice 2 or downward stems for feet: VexFlow multi-voice padding introduces horizontal rest displacement, crosses stems, and deforms noteheads on percussion staves.

**Canvas stage geometry enclosure (hard rule)**: Any interactive overlay (guidelines, drop zones, playheads) layered on top of a VexFlow SVG must reside inside a dedicated stage container whose inline style dimensions (`width`, `height`) strictly match the VexFlow renderer's canvas dimensions (`style={{ width, height }}`). Never wrap the SVG in flexible or centered flex parents without pinning the stage bounding box.

## Modal and tab component tests (hard rule)

When selecting buttons or tabs that share names with launchers or headings (e.g. launcher `Manage Systems, Formulas & Ostinatos` vs tab `Ostinatos (2)`), anchor regex queries (`/^Ostinatos/i`) or scope queries to the modal container rather than loose unanchored substring matches (`/Ostinatos/i`) that trigger ambiguous multiple-element errors.

## One style (judgement call)

Reach for this section whenever a diff adds or repaints color. Every surface draws from a token role: `bg-primary`/`text-primary` for the Accent (interactive elements, active states, the Playhead), Success/Warning/Destructive for state, `bg-card`/`text-foreground`/`border-border` for surfaces, `secondary`/`muted` for neutral chrome. The names and their fixed meanings live in `GLOSSARY.md` § Interface — read it before reviewing a restyle.

Judge the *role*, not the spelling: Warning marks genuine attention, Destructive marks danger or an invalid state, Success marks a confirmed one. A label that carries no caution stays neutral; difficulty tiers borrow the three by hue; the Playhead is one Accent treatment in every view. `npm run check:style` already settles the mechanical half (raw palettes, `dark:` variants, `rgba(` glows, radii other than `rounded-none`, dead theme blocks), so spend review effort on whether the meaning holds.

The theme's single definition point is `src/index.css` (tokens and the named utilities) plus `tailwind.config.js` (role registration); the decision and its rejected alternatives are in `docs/adr/0007-single-light-theme-token-palette.md`.

## Audio seams (judgement call)

Audio behaviour is asserted at two seams, and only their union covers what the user hears. The fake Web Audio recorder in `src/test/fakeWebAudio.ts` (`FakeAudioContext`, installed globally in `src/test/setup.ts`) settles graph contracts: which persistent native nodes exist, their labels and routing, `gainWrites`, transient `AudioBufferSourceNode` triggers, and lookahead scheduling in `NativeLookaheadTransport`. It cannot see what a real audio context pays for, so any change to the audio graph must also pass `npm run check:live`, which drives a real Chromium and asserts the eager graph's node budget (`NODE_BUDGET = 50`), beat cadence against the configured tempo, decoded `.wav` buffers, an `AudioBufferSourceNode` started per beat, and a clean console. Never claim audio works from the jsdom suites alone.

With Tone.js and synthesized fallback retired (`docs/adr/0014-pure-webaudio-wav-sample-engine.md`), the eager graph holds only persistent mixer/master native nodes (`<= 10` nodes) and creates one-shot `AudioBufferSourceNode`s per trigger. Assert the bound at both seams — the deterministic half headless in `src/audio/__tests__/EagerGraphNodeBudget.test.ts` (zero synths, `<= 10` persistent nodes before playback), and the browser half through `npm run check:live`.

## Checks

`npm run check` (`node scripts/one-style.mjs && tsc --noEmit && vitest run`) is the repo's guardrail, enforced by a pre-commit hook and by CI (`.github/workflows/check.yml`, on pushes to `main` and `feat/**`). Diff review should confirm the changed files pass it; run it rather than assuming.

The guardrail hook is tracked at `.githooks/pre-commit` (throwaway `scratch-*` probes must not ship, and `npm run check` must pass). A fresh clone or worktree gets it with one command: `git config core.hooksPath .githooks`.

`npm run check:style` is the deterministic one-style sweep — raw palette classes, `dark:` variants, `rgba(` glows, and any radius other than `rounded-none` in component string literals, plus dead theme blocks in `src/index.css` and `tailwind.config.js`, plus Tailwind compile warnings. It reports file and line, so reach for it instead of hand-built shell regexes. `npm run check:tokens` prints which theme tokens the app consumes. `npm run check:live` (`scripts/live-audio-guard.mjs`) runs the browser-seam audio guard: it boots its own vite and drives Chromium, so it is deliberately outside `npm run check`, which must stay fast and headless — but CI runs it as its own `live-audio` job (`.github/workflows/check.yml`), so an audio regression is caught at push time, not only when someone remembers the guard. That makes the § Audio seams rule the one guardrail cannot enforce per ticket: an agent that touched `src/audio/**` runs `npm run check:live` once before landing the branch (during `/code-review` or final pre-merge verification) rather than on every intermediate ticket commit, and reports the result.
