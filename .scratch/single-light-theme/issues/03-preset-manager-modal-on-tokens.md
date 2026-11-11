# 03: Preset Manager modal on tokens

**What to build:** The Preset Manager modal renders entirely through token roles: the shared Modal Scrim, Accent for its action buttons and section headers (was teal-600/teal-400 everywhere), Destructive for delete affordances (was rose), Warning only where caution is genuine (amber badge → Warning token), token inputs and badges, square corners. Its suite gains the same class-role assertions.

**Blocked by:** 01 (Theme foundation).

**Status:** resolved

- [x] Shared Modal Scrim utility used; no `bg-black/60` literal scrim
- [x] Zero `teal-*`, `rose-*`, `amber-*` classes in the modal component
- [x] Delete/active/confirm affordances read Destructive/Accent by meaning, not by palette name
- [x] Suite asserts token role classes present and raw palette classes absent
- [x] `npm run check` green

## Answer

Scrim `bg-black/60 backdrop-blur-sm` -> `modal-scrim`. Teal icon tiles, section headers, badges, inputs (`focus:ring-primary`) and action buttons (`bg-primary hover:bg-primary/80 text-primary-foreground`) become Accent; the delete affordance and the rose danger header/badge become `text-destructive hover:text-destructive hover:bg-destructive/10` and `border-destructive/30 text-destructive`; the Custom Dawson System badge first took `border-warning/40 text-warning` per the amber→Warning mapping, then moved to neutral `border-border text-muted-foreground` chrome in 06a430c, a review decision: a label naming a user-authored system carries no caution (see ADR 0007's follow-up paragraph). Every `rounded-xl`/`rounded-lg`/`rounded-md` becomes `rounded-none` (this fixed the pre-existing rounded corners on the preset grid and inputs). Suite gains role-present and palette-absent assertions. Done in commit "style(preset-manager): Modal Scrim, Accent/Destructive/Warning token roles, square corners (ticket 03)" (8d8fc13).

## Comments
