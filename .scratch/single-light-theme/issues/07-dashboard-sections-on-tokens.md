# 07: Dashboard sections on tokens

**What to build:** The dashboard reads as one style: Metronome panel's Dropout Mode banner, dropout icon, and probability readout become Warning; the Mixer Panel's Custom Practice Preset chip becomes neutral (`secondary`/`muted` token roles — it carries no caution meaning); the Dawson Orchestration Section's kick-highlight text becomes Destructive (was rose); the Reading Training Section's tier chips borrow the Status Colors. The App shell's text-selection style keeps referencing token roles. Dashboard suites plus the App suite gain token-role assertions.

**Blocked by:** 01 (Theme foundation).

**Status:** resolved

- [x] Metronome: zero `amber-*` classes; dropout states read Warning
- [x] Mixer Panel: Custom chip neutral, zero `amber-*`
- [x] Dawson section: zero `rose-*`; kick/short-note highlights use Destructive/Accent token roles
- [x] Reading Training Section: tier chips on Success/Warning/Destructive
- [x] `npm run check` green

## Answer

Metronome.tsx Dropout Mode banner `bg-amber-500/20 border-amber-500 text-amber-300` -> `bg-warning/20 border-warning text-warning`, dropout icons and the probability readout `text-warning`. MixerPanel.tsx Custom Practice Preset chip -> neutral `bg-secondary text-secondary-foreground` (no caution meaning). DawsonOrchestrationSection.tsx kick highlights `text-rose-400` -> `text-destructive` (Linear Diddle legend -> `text-warning`), section header and menu rose -> Destructive. ReadingTrainingSection.tsx tiers -> `bg-success/40 text-success border border-success/40` / Warning / Destructive. The App suite asserts the shell's selection roles stay token-based (`selection:bg-accent selection:text-accent-foreground`). Done in commit "style(dashboard-sections): Warning dropout, neutral Custom chip, Status-Color tiers (ticket 07)" (b6287c7).

## Comments
