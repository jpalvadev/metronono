# 05: Partiture formula canvas cluster on tokens

**What to build:** The Partiture formula canvas, its editor, and its palette toolbar become the one style: canvas sits on the card surface with token ink and token borders (no hardcoded white/slate), all corners square (was `rounded-xl`), selection/active states on the Accent, delete affordances and its Playhead Destructive (was rose playhead + rose glow), palette-category chips Warning/Destructive by meaning, filled buttons `primary` + `primary-foreground`. Both canvas Playheads switch to the Accent and reference the shared Playhead glow utility — no inline `rgba(` glows anywhere. Canvas drag/editor suites gain the class-role assertions.

**Blocked by:** 01 (Theme foundation) — and pairs with 06 so both Playheads land together.

**Status:** ready-for-agent

- [ ] Canvas container uses card/foreground/border token roles, `rounded-none`
- [ ] Zero `teal-*`, `rose-*`, `slate-*`, `text-white` classes and zero `rgba(` glow literals across canvas, editor, and toolbar
- [ ] Canvas Playhead is Accent with the shared glow utility
- [ ] Suites assert token role classes present and raw palette classes absent
- [ ] `npm run check` green

## Comments
