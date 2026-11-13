# 01: Unbounded Reading View & Mobile Width Fit

**What to build:** Remove the vertical height limit and both internal scrollbars from **Reading View** so the notation grows naturally with the page, and remove the minimum width floor so the rendered score never overflows horizontally on narrow mobile screens (~320 px).

**Blocked by:** None (can start immediately).

**Status:** resolved

- [ ] **Reading View** score container has no `max-h-*` height cap and no internal `overflow-x-auto` or `overflow-y-auto` scrollbars.
- [ ] On narrow viewports (< 300 px container width), the rendered score SVG width never exceeds the container's `clientWidth` (`scrollWidth <= clientWidth`).
- [ ] Score renderer respects small container widths without forcing a wider minimum width than the container provides.
- [ ] Renderer and component tests verify unbounded height and zero horizontal overflow on narrow widths.
