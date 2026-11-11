# 03: Preset Manager modal on tokens

**What to build:** The Preset Manager modal renders entirely through token roles: the shared Modal Scrim, Accent for its action buttons and section headers (was teal-600/teal-400 everywhere), Destructive for delete affordances (was rose), Warning only where caution is genuine (amber badge → Warning token), token inputs and badges, square corners. Its suite gains the same class-role assertions.

**Blocked by:** 01 (Theme foundation).

**Status:** ready-for-agent

- [ ] Shared Modal Scrim utility used; no `bg-black/60` literal scrim
- [ ] Zero `teal-*`, `rose-*`, `amber-*` classes in the modal component
- [ ] Delete/active/confirm affordances read Destructive/Accent by meaning, not by palette name
- [ ] Suite asserts token role classes present and raw palette classes absent
- [ ] `npm run check` green

## Comments
