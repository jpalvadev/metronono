# 02: Formula Editor Dialog fully on tokens

**What to build:** The Formula Editor Dialog modal — the worst offender, all teal + slate scrim + rose/emerald/amber status mix — renders entirely through token roles: Accent for selection/highlight/confirm actions, Status Colors for invalid (Destructive), caution (Warning), and valid (Success) formula states, the shared Modal Scrim behind it, token surfaces and inputs, `primary-foreground` on filled buttons, and `rounded-none` throughout. Its vitest suite gains jest-dom class assertions (token roles present, raw palette classes absent) beside the existing behavioral ones.

**Blocked by:** 01 (Theme foundation).

**Status:** ready-for-agent

- [ ] Dialog renders with the shared Modal Scrim utility, no `bg-slate-950/75` literal scrim
- [ ] Zero `teal-*`, `rose-*`, `emerald-*`, `amber-*`, `slate-*` classes in the dialog component
- [ ] Valid/caution/invalid formula states read as Success/Warning/Destructive token roles
- [ ] Suite asserts the token role classes and the absence of raw palette classes in the rendered DOM
- [ ] `npm run check` green

## Comments
