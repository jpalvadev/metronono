# 04: Window Auto-Scroll Toggle & Browser E2E Verification

**What to build:** Add an `Auto-scroll` toggle button (`OFF` by default, visible on mobile and desktop) to the **Reading View** header that smoothly scrolls the browser window when playback moves to a system row outside the viewport, automatically disengages (`OFF`) when the user scrolls manually, and verify the complete responsive layout and extended bar counts in a real browser.

**Blocked by:** 01: Unbounded Reading View & Mobile Width Fit, 02: Progressive 4→3→2→1 Columns & Safe Selector, 03: Extended Bar Counts (32, 48, 64)

**Status:** resolved

- [ ] `Auto-scroll` toggle button is visible in the **Reading View** header across all screen sizes and starts `OFF` by default.
- [ ] When `Auto-scroll` is `ON` and playback is active, advancing to a system row outside the visible viewport smoothly scrolls the window to keep it in view (triggered on row change, not every animation frame).
- [ ] Manual user scrolling (`wheel`, `touchmove`, or non-programmatic `scroll`) while `Auto-scroll` is `ON` automatically switches `Auto-scroll` to `OFF`.
- [ ] Component tests cover toggle state, row-change window scrolling, and manual-scroll disengagement; Playwright browser verification confirms zero horizontal or internal scrollbars at desktop and mobile (~320px/375px) viewports with 32/64 bars.
