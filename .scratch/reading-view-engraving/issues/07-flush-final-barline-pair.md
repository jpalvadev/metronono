# 07: Flush final barline pair

**What to build:** The score ends with a thin-plus-thick final barline pair, sized like the other bracketing barlines, and the black stave line terminates flush at the thick barline — no 1 px tail of the line poking past it, no gap between line end and bar.

**Blocked by:** 04 (the final pair adopts the system-derived barline extent).

**Status:** resolved

- [x] Final thin + thick pair spans the same full block height as the system's dividing barlines
- [x] Stave line end x equals the thick final barline x (no overhang, no gap)
- [x] Last measure's music still sits left of the final pair

## Answer

The final pair moved into Pass 1.5 and uses the last system's `systemBarlineSpan` (same extent as the dividers). The thick stroke (3 px) sits exactly at `rightX` — the stave segment's end x — so line end == thick barline x; the thin partner at `rightX − FINAL_THIN_OFFSET` (6 px). Guard test asserts x equality within 0.6 px, pair spacing, equal spans vs the dividers, and the last measure's music to the left. Done in commit "fix(notation): flush thin+thick final barline pair at the stave line end (ticket 07)".
