# 02: Formula Editor Dialog fully on tokens

**What to build:** The Formula Editor Dialog modal — the worst offender, all teal + slate scrim + rose/emerald/amber status mix — renders entirely through token roles: Accent for selection/highlight/confirm actions, Status Colors for invalid (Destructive), caution (Warning), and valid (Success) formula states, the shared Modal Scrim behind it, token surfaces and inputs, `primary-foreground` on filled buttons, and `rounded-none` throughout. Its vitest suite gains jest-dom class assertions (token roles present, raw palette classes absent) beside the existing behavioral ones.

**Blocked by:** 01 (Theme foundation).

**Status:** resolved

- [x] Dialog renders with the shared Modal Scrim utility, no `bg-slate-950/75` literal scrim
- [x] Zero `teal-*`, `rose-*`, `emerald-*`, `amber-*`, `slate-*` classes in the dialog component
- [x] Valid/caution/invalid formula states read as Success/Warning/Destructive token roles
- [x] Suite asserts the token role classes and the absence of raw palette classes in the rendered DOM
- [x] `npm run check` green

## Answer

Scrim root `bg-slate-950/75 backdrop-blur-md` -> `modal-scrim`. Teal is gone everywhere: icon tile, badges, `focus:ring-primary`, duration readout, Sparkles, hover chips and filled buttons move to `primary` (+ `text-primary-foreground` on fills, `hover:bg-primary/10`). The three formula-state chips are `bg-success/10 border-success/30 text-success`, `bg-warning/10 …`, `bg-destructive/10 …`; the reset button is `bg-destructive hover:bg-destructive/80 text-destructive-foreground`; inputs keep `border-input`/`bg-muted/30`; corners `rounded-none`. The suite adds jest-dom role assertions plus a whole-DOM absence sweep (`/(?:teal|rose|emerald|amber|purple|slate)-\d|bg-white|text-white|dark:|rgba\(/`). Done in commit "style(formula-editor-dialog): Modal Scrim + Accent/Success/Warning/Destructive token roles (ticket 02)" (423685a).

## Comments
