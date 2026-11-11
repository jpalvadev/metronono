Status: ready-for-agent

# Spec: One Style — Single Light Theme, Token-Only Palette

## Problem Statement

The app renders with competing styles. A token theme (white at the root, with a dormant dark "Lyra Mauve Dark & Teal" block that nothing activates) fights against hardcoded Tailwind palettes: teal decorations scattered across the modals (formula editor, preset manager, sample bank, palette toolbar, partiture canvas and editor), rose/amber/emerald status colors, slate surfaces in the formula canvas, two different modal scrims (`bg-black/60` and `bg-slate-950/75`), two playheads in two colors (teal in the notation overlay, rose in the formula canvas), and one surface that ignores the token system and hardcodes white, slate ink, and rounded corners. Users see orange accents here, teal there, rose and emerald for the same kinds of state in different views.

## Solution

Exactly one style, per ADR 0007: white theme only, every color flowing through token roles. Delete the dead dark theme; keep the warm-orange Accent (`--primary`) as-is; complete the Status Colors with Success and Warning tokens alongside the existing Destructive; map every raw palette usage to its meaning (teal→Accent, rose→Destructive, amber→Warning, emerald→Success); give all modals one Modal Scrim; unify the Playhead to the Accent with a single shared glow; strip dead tokens; and normalize geometry to the app's `rounded-none` standard. Nothing in a component may name a raw palette color, an `rgba` glow, or a `dark:` variant.

## User Stories

1. As a practice user, I want the whole app to render in one white theme, so that no surface ever flashes dark when I move between panels.
2. As a practice user, I want the Accent to stay the same warm orange I already know, so that my muscle memory for primary controls is unchanged.
3. As a practice user, I want interactive and active elements in modals (buttons, selection states, indicators) to use the Accent instead of teal, so that modals look like the rest of the app.
4. As a practice user, I want no teal anywhere — not in the formula editor dialog, preset manager, sample bank modal, palette toolbar, partiture canvas, or notation playhead overlay.
5. As a practice user, I want delete and invalid actions to share one Destructive color across every view, so that "this is dangerous/invalid" reads identically everywhere.
6. As a practice user, I want valid/confirmed states to use one Success color, so that a green confirmation means the same thing in the formula dialog as in the reading view tiers.
7. As a practice user, I want attention states (Dropout Mode banner, dropout probability) to use one Warning color, so that caution is recognizable at a glance.
8. As a practice user, I want the Custom Practice Preset chip to be neutral, so that a label that carries no caution is never painted as Warning.
9. As a practice user, I want difficulty tier 1/2/3 chips in the Reading View and Reading Training Section to borrow Success/Warning/Destructive by hue, so that difficulty and status share one Status Color vocabulary.
10. As a practice user, I want all three modals to dim the page behind them with the one Modal Scrim, so that no dialog feels like a different app.
11. As a practice user, I want one Accent-colored Playhead in both the notation views and the partiture formula canvas, so that "current position" is one concept everywhere.
12. As a practice user, I want the Playhead glow to be one shared treatment rather than per-component hardcoded rgba glows.
13. As a practice user, I want the partiture formula canvas to sit on the standard card surface (`bg-card`/`text-foreground`/`border-border`) rather than hardcoded white and slate ink.
14. As a practice user, I want every corner in the app to be square (`rounded-none`, radius 0), so the formula canvas's rounded-xl panels stop being the one rounded exception.
15. As a practice user, I want the dead dark theme deleted outright, so no future update can accidentally half-reintroduce it.
16. As a practice user, I want unused theme tokens (chart ramp, sidebar block) pruned, so the theme declares only what the app consumes.
17. As a practice user, I want the Destructive red kept distinct from the orange Accent, so an error never looks like a primary control.
18. As a practice user, I want the metronome's amber dropout warnings, the mixer's custom-preset chip, and the dawson section's kick highlights to all follow the token roles, so the dashboard reads as one style.
19. As a developer, I want components to be mechanically scannable for raw palette names, so a grep sweep can prove the one-style invariant.
20. As a developer, I want the restyle to not break any existing behavior tests, so `npm run check` stays green end to end.

## Implementation Decisions

- **Theme stylesheet (single light theme)**: delete the `.dark` token block, the `.dark` VexFlow notation invert filters, and every `dark:` utility variant in the UI primitives (button, badge, slider) and the formula canvas surface. Prune the unused `--chart-*` ramp and the whole `--sidebar-*` block. Keep exactly the consumed token set plus two additions: `--success` and `--warning`, authored in the same role shape as the existing `--destructive`. The Accent (`--primary`, warm orange) keeps its current hue; `--destructive` stays its current distinct red.
- **Tailwind theme config**: delete the custom `teal` scale entirely; register `success` and `warning` as token-backed colors matching the stylesheet additions. With teal gone, no component can reference it — the invariant is compile-enforced.
- **Status mapping (global, by meaning)**: `rose-*` → Destructive, `amber-*` → Warning, `emerald-*` → Success, with tints following the app's existing `/NN` opacity idiom (`bg-destructive/10`, `border-destructive/30`, etc.). Difficulty tiers borrow the Status Colors by hue (tier 1 = Success, tier 2 = Warning, tier 3 = Destructive).
- **Neutral overrides**: the Custom Practice Preset chip in the mixer is not a Warning — it moves to neutral `secondary`/`muted` token roles.
- **Modal Scrim**: one shared named utility defined once in the theme stylesheet (foreground-ink dim + `backdrop-blur-md`), applied by all three modals (formula editor dialog, preset manager, sample bank modal); the three existing scrim spellings collapse to it.
- **Playhead unification**: the notation overlay playhead and the formula-canvas playhead both use the Accent; the hardcoded `rgba` glows collapse into one named glow utility in the theme stylesheet, derived from the Accent token, referenced by both.
- **Surface + geometry fixes**: the formula canvas container (hardcoded white background, slate ink, slate border, `rounded-xl`) moves to `bg-card`/`text-foreground`/`border-border`/`rounded-none`; its teal button fills become Accent with `primary-foreground` text. `--radius: 0px` stays the app standard.
- **Modules touched** (component-level): the three modals (formula editor dialog, sample bank modal, preset manager), the dawson cluster (partiture formula canvas/editor, palette toolbar, orchestration section), the notation cluster (reading view, drum staff view, playhead overlay), the dashboard (metronome, mixer panel, reading training section), the app shell, the UI primitives (button/badge/slider), the theme stylesheet, and the Tailwind theme config.
- **Notation engraving ink is out of play**: VexFlow keeps its default black notation on the white card; only the dark-mode invert filters are removed along with the dead theme.
- **Android/Capacitor shell**: no manifest or meta theme-color pins exist today, so there is nothing to repaint in the native shell.

## Testing Decisions

- **Seams: existing only, no new seams.** Style assertions hang off the existing React-component render seams — each component's own vitest suite (`@testing-library/react` + jest-dom) and the App suite for shell-level surfaces. The ideal count stays at those already in place; nothing new is introduced.
- **What makes a good style test**: only externally visible contract — assert with jest-dom class matchers that the token role classes are present (`bg-primary`, `text-destructive`, `bg-success/10` …) and that raw palette classes are absent in the rendered DOM. Do not assert computed pixel colors: jsdom does not resolve Tailwind classes to CSS values, and the token→hue truth is the theme stylesheet's job (reviewed, plus compile coverage via `npm run check`).
- **Modules to test**: the modal suites (formula editor dialog, preset manager, sample bank modal), the dawson cluster suites (canvas, canvas-drag, palette toolbar, formula editor), the notation suites (playhead overlay, reading view, drum staff view), the dashboard suites (metronome, mixer panel, reading training, dawson orchestration section), and the App suite.
- **Prior art**: every listed suite already renders its component at this seam (see the mixer/metronome suites' "tested at the React component seam" convention); the playhead overlay suite already asserts rendered marker DOM. Assertions stay behavioral (state, roles, test-ids) — style assertions are added alongside, never replacing them.
- **Invariant guard**: after implementation, a repo-wide scan must find zero raw palette references in components (`teal-`, `rose-`, `amber-`, `emerald-`, `slate-`, `bg-black`, `text-white`, `dark:` prefixes) and zero `rgba(` glow literals — a sweep, not a test.
- **Gate**: `npm run check` (`tsc --noEmit && vitest run`) per the repo guardrail; jsdom navigation noise is the known-benign class.

## Out of Scope

- Reintroducing any dark theme, `dark:` variants, or OS media-query dark mode (deliberately rejected by ADR 0007).
- Designing the `--chart-*` data palette — deleted; if stats views arrive later, their colors get designed then.
- VexFlow engraving geometry, the notation renderers' SVG layout, and audio behavior of any kind.
- Layout/spacing changes beyond corner radius, and any Android native-shell branding.
- New contrast/accessibility audits — contrast tuning for the Status Colors is a follow-up concern, not part of this unification.

## Further Notes

- Vocabulary is now in `GLOSSARY.md`: Accent, Status Colors, Modal Scrim, Playhead — use these names in tickets and commits.
- ADR `docs/adr/0007-single-light-theme-token-palette.md` records the decision and its rejected alternatives; components must not "helpfully" re-add shadcn dark defaults.
- The restyle is mechanical but broad (~14 component files + 2 theme files); it should land as a sequence of small per-surface slices (one modal, one cluster, one dashboard section per commit) so the invariant stays provable at every step.
- The scrim uses the existing `--foreground` ink — no new scrim token is introduced; the shared named utility is the single definition point.
