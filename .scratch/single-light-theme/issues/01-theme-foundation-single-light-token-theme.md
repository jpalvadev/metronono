# 01: Theme foundation — one light theme, shared style definitions

**What to build:** The theme stylesheet and Tailwind color config become the single definition point the rest of the app converts into: a white-only token theme with the full Status Colors triple (Success, Warning, Destructive), a named Modal Scrim utility, and a named Playhead glow utility derived from the Accent. The dead dark theme disappears entirely — the `.dark` token block, the `.dark` VexFlow invert filters, every `dark:` variant in the UI primitives (button, badge, slider), the unused chart ramp and sidebar token blocks — and the custom teal scale is deleted from the Tailwind config. The Accent keeps its current warm-orange hue.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `--success` and `--warning` tokens exist in the theme stylesheet in the same role shape as the existing `--destructive`, and are registered as token-backed colors in the Tailwind theme config
- [x] A single named Modal Scrim utility (foreground-ink dim + backdrop blur) is defined once in the theme stylesheet
- [x] A single named Playhead glow utility, derived from the Accent, is defined once in the theme stylesheet
- [x] No `.dark` token block, no `.dark` selectors, no invert filters remain in the theme stylesheet
- [x] No `dark:` variants remain in button, badge, or slider UI primitives
- [x] No `--chart-*`, `--sidebar-*`, or custom teal scale remain in the stylesheets/config
- [x] Accent hue unchanged; `npm run check` green

## Answer

`src/index.css` lost the whole `.dark` "Lyra Mauve Dark & Teal" block, the `.dark` VexFlow invert filters, the `--chart-*` ramp and the `--sidebar-*` block. `--success: oklch(0.596 0.183 155.7)` and `--warning: oklch(0.769 0.17 73.4)` join `--destructive` in the same role shape (each with a `-foreground` counterpart), and `@layer utilities` now holds the two shared names defined once: `.modal-scrim` (`color-mix(in oklab, var(--foreground) 60%, transparent)` + 12 px backdrop blur) and `.playhead-glow` (`box-shadow: 0 0 10px color-mix(in oklab, var(--primary) 85%, transparent)`). `tailwind.config.js` deletes the custom `teal` scale and registers `success`/`warning` as `var()`-backed colors; `src/components/ui/button.tsx` loses every `dark:` variant. The Accent keeps `oklch(0.553 0.195 38.402)`. Done in commit "style(theme): single light theme, success/warning tokens, named Modal Scrim and Playhead glow (ticket 01)" (aa356f4); the deprecated `darkMode: false` key it carried was dropped in 7f04c8e (ticket 08), since Tailwind v3.4 treats it as `media` and warns on it.

## Comments
