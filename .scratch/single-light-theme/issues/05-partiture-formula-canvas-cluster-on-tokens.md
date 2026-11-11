# 05: Partiture formula canvas cluster on tokens

**What to build:** The Partiture formula canvas, its editor, and its palette toolbar become the one style: canvas sits on the card surface with token ink and token borders (no hardcoded white/slate), all corners square (was `rounded-xl`), selection/active states on the Accent, delete affordances and its Playhead Destructive (was rose playhead + rose glow), palette-category chips Warning/Destructive by meaning, filled buttons `primary` + `primary-foreground`. Both canvas Playheads switch to the Accent and reference the shared Playhead glow utility — no inline `rgba(` glows anywhere. Canvas drag/editor suites gain the class-role assertions.

**Blocked by:** 01 (Theme foundation) — and pairs with 06 so both Playheads land together.

**Status:** resolved

- [x] Canvas container uses card/foreground/border token roles, `rounded-none`
- [x] Zero `teal-*`, `rose-*`, `slate-*`, `text-white` classes and zero `rgba(` glow literals across canvas, editor, and toolbar
- [x] Canvas Playhead is Accent with the shared glow utility
- [x] Suites assert token role classes present and raw palette classes absent
- [x] `npm run check` green

## Answer

Canvas container `rounded-xl bg-white dark:bg-white text-slate-950 border border-slate-200/90` -> `rounded-none bg-card text-foreground border border-border`. Both Playheads collapse to the Accent plus the shared glow: `bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]` and `bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]` -> `bg-primary playhead-glow`; the measure highlight is `bg-primary/10 border-primary/30 rounded-none`. Note chips: filled `bg-primary text-primary-foreground`, selected `bg-primary/20 text-primary border-primary/50`, category chips Warning/Destructive by meaning (`bg-warning/20 text-warning border-warning/50`, `bg-destructive/20 …`), eraser hover `hover:text-destructive`. The palette toolbar and formula editor lose every `rounded-xl/lg/md`, `text-white` and teal/slate class. Four suites (canvas, canvas-drag, toolbar, editor) gain role + absence assertions, and the Formula Editor Dialog suite gained the full-DOM sweep. Done in commit "style(partiture-canvas-cluster): card surface, square geometry, Accent Playheads with shared glow (ticket 05)" (fadb58a).

## Comments
