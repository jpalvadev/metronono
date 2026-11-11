# 07: Dashboard sections on tokens

**What to build:** The dashboard reads as one style: Metronome panel's Dropout Mode banner, dropout icon, and probability readout become Warning; the Mixer Panel's Custom Practice Preset chip becomes neutral (`secondary`/`muted` token roles — it carries no caution meaning); the Dawson Orchestration Section's kick-highlight text becomes Destructive (was rose); the Reading Training Section's tier chips borrow the Status Colors. The App shell's text-selection style keeps referencing token roles. Dashboard suites plus the App suite gain token-role assertions.

**Blocked by:** 01 (Theme foundation).

**Status:** ready-for-agent

- [ ] Metronome: zero `amber-*` classes; dropout states read Warning
- [ ] Mixer Panel: Custom chip neutral, zero `amber-*`
- [ ] Dawson section: zero `rose-*`; kick/short-note highlights use Destructive/Accent token roles
- [ ] Reading Training Section: tier chips on Success/Warning/Destructive
- [ ] `npm run check` green

## Comments
