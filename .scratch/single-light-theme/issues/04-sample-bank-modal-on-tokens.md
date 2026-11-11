# 04: Sample Bank modal on tokens

**What to build:** The Sample Bank modal renders entirely through token roles: shared Modal Scrim, Accent for its iconography and interactive hover states (was teal-400 throughout), Destructive for import/export danger and error affordances (was rose), Success for confirmation checks (CheckCircle). Its suite gains the class-role assertions.

**Blocked by:** 01 (Theme foundation).

**Status:** ready-for-agent

- [ ] Shared Modal Scrim utility used; no `bg-black/60` literal scrim
- [ ] Zero `teal-*`, `rose-*` classes in the modal component
- [ ] Danger/confirm states read Destructive/Success by meaning
- [ ] Suite asserts token role classes present and raw palette classes absent
- [ ] `npm run check` green

## Comments
