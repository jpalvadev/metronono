# 04: Sample Bank modal on tokens

**What to build:** The Sample Bank modal renders entirely through token roles: shared Modal Scrim, Accent for its iconography and interactive hover states (was teal-400 throughout), Destructive for import/export danger and error affordances (was rose), Success for confirmation checks (CheckCircle). Its suite gains the class-role assertions.

**Blocked by:** 01 (Theme foundation).

**Status:** resolved

- [x] Shared Modal Scrim utility used; no `bg-black/60` literal scrim
- [x] Zero `teal-*`, `rose-*` classes in the modal component
- [x] Danger/confirm states read Destructive/Success by meaning
- [x] Suite asserts token role classes present and raw palette classes absent
- [x] `npm run check` green

## Answer

Scrim `bg-black/60 backdrop-blur-sm` -> `modal-scrim`. All iconography (HardDrive, Database, Download, Upload, Music, Volume2, Disc) moves teal -> `text-primary`, badges to `bg-primary/20 text-primary border-primary/30`; import/export notifications are `bg-success/10 border-success/30 text-success` with `CheckCircle2 text-success` vs `bg-destructive/10 … text-destructive` with `AlertCircle text-destructive`. Suite asserts those roles and sweeps the whole rendered DOM for raw palette, `bg-black`, and `rgba(`. Done in commit "style(sample-bank-modal): Modal Scrim, Accent/Destructive/Success token roles (ticket 04)" (dc0fa8b).

## Comments
