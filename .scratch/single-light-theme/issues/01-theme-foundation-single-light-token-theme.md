# 01: Theme foundation — one light theme, shared style definitions

**What to build:** The theme stylesheet and Tailwind color config become the single definition point the rest of the app converts into: a white-only token theme with the full Status Colors triple (Success, Warning, Destructive), a named Modal Scrim utility, and a named Playhead glow utility derived from the Accent. The dead dark theme disappears entirely — the `.dark` token block, the `.dark` VexFlow invert filters, every `dark:` variant in the UI primitives (button, badge, slider), the unused chart ramp and sidebar token blocks — and the custom teal scale is deleted from the Tailwind config. The Accent keeps its current warm-orange hue.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `--success` and `--warning` tokens exist in the theme stylesheet in the same role shape as the existing `--destructive`, and are registered as token-backed colors in the Tailwind theme config
- [ ] A single named Modal Scrim utility (foreground-ink dim + backdrop blur) is defined once in the theme stylesheet
- [ ] A single named Playhead glow utility, derived from the Accent, is defined once in the theme stylesheet
- [ ] No `.dark` token block, no `.dark` selectors, no invert filters remain in the theme stylesheet
- [ ] No `dark:` variants remain in button, badge, or slider UI primitives
- [ ] No `--chart-*`, `--sidebar-*`, or custom teal scale remain in the stylesheets/config
- [ ] Accent hue unchanged; `npm run check` green

## Comments
