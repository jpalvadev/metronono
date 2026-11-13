# 02: Progressive 4→3→2→1 Columns & Safe Selector

**What to build:** Update automatic measures-per-system breakpoints to step progressively `4 → 3 → 2 → 1` as container width shrinks, and update the **Reading View** header column selector to `Auto | 1 | 2 | 3 | 4` (defaulting to `Auto`) while clamping manual selections to the maximum columns supported by the current width.

**Blocked by:** 01: Unbounded Reading View & Mobile Width Fit

**Status:** resolved

- [ ] Automatic layout selects `4` measures per system at `>= 960px`, `3` at `720px–959px`, `2` at `460px–719px`, and `1` below `460px`.
- [ ] **Reading View** header renders an `Auto | 1 | 2 | 3 | 4` column selector with `Auto` active by default.
- [ ] Selecting a fixed column count clamps to at most the automatic column limit for the current width, preventing horizontal overflow when resizing narrower.
- [ ] Renderer and component tests verify all 4 breakpoints, default `Auto` behavior, and width-clamped manual overrides.
