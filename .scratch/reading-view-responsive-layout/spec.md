# Spec: Responsive Reading View Layout, Extended Bar Counts, and Auto-Scroll Toggle

Status: completed

## Problem Statement

On the Single-Line Reading Training section (**Reading View**), the notation container is constrained to a `460px` maximum height with internal vertical and horizontal scrollbars. When practicing longer **Reading Lines** or viewing the app on narrower viewports, this creates unwanted nested scrollbars, clips the vertical flow of the page, and can cause horizontal overflow on small mobile screens. Additionally, the automatic measures-per-system layout jumps directly from 4 measures per row to 2 and 1 (skipping 3), any manual column selection locks out responsive resizing, and the Procedural Generator only supports up to 16 bars instead of longer 32-, 48-, and 64-bar reading exercises.

## Solution

Remove the vertical height cap and both internal scrollbars from **Reading View** so the notation grows naturally with the document height and never overflows horizontally at any viewport width, including narrow mobile screens. Update the automatic layout breakpoints to step smoothly from `4 → 3 → 2 → 1` measures per system as container width shrinks, expose an `Auto | 1 | 2 | 3 | 4` column selector defaulting to `Auto` (and capping manual selections to what fits the current width), expand the Procedural Generator bar-count options to `4, 8, 16, 32, 48, 64`, and replace unconditional internal auto-scrolling with an explicit `Auto-scroll` toggle button (`OFF` by default) that smoothly scrolls the browser window when active and automatically turns `OFF` upon manual user scrolling.

## User Stories

1. As a drummer practicing sight-reading, I want **Reading View** to have no vertical height limit or internal vertical scrollbar, so that I can view and scroll the full exercise naturally as part of the page.
2. As a mobile or narrow-window user, I want **Reading View** to have zero horizontal scrollbar and zero horizontal overflow even on ~320px viewports, so that measures never clip or require sideways scrolling.
3. As a user resizing the browser window, I want the number of measures per system row to step down progressively from 4 to 3 to 2 to 1 as the available width shrinks, so that notation remains legible at every screen size.
4. As a desktop or tablet user, I want a column selector (`Auto | 1 | 2 | 3 | 4`) in the **Reading View** header defaulting to `Auto`, so that layout adapts automatically by default while still letting me pick a denser or sparser fixed column count when desired.
5. As a user who selected a fixed column count (e.g., 4) and then shrinks the window, I want the rendered columns per row to be capped to the maximum allowed by the current width, so that a manual choice never reintroduces horizontal overflow.
6. As a drummer building endurance and long-form sight-reading stamina, I want bar-count options of `32`, `48`, and `64` in addition to `4`, `8`, and `16` in the Procedural Generator, so that I can practice full-page and multi-page reading exercises.
7. As a user starting playback from the Metronome or Dawson Orchestration controls at the top of the page, I want `Auto-scroll` to be `OFF` by default, so that the page does not unexpectedly jump away from the controls I am adjusting.
8. As a drummer playing through a 32-, 48-, or 64-bar **Reading Line**, I want an `Auto-scroll` toggle button in the **Reading View** header (visible on both mobile and desktop), so that the window smoothly keeps the active system row in view as the **Playhead** advances.
9. As a user with `Auto-scroll` turned `ON`, I want manual scrolling (wheel, touch drag, or scrollbar drag) to automatically turn `Auto-scroll` `OFF`, so that I can inspect another part of the score without fighting the **Playhead** follower.

## Implementation Decisions

- **Unbounded Vertical Flow & Zero Horizontal Overflow in Reading View**:
  - Remove the `max-h-[460px]` constraint and internal `overflow-x-auto` / `overflow-y-auto` scroll wrapper from **Reading View**, letting the rendered SVG expand to its full natural height inside the page flow.
  - Remove the `300px` minimum-width floor when passing the measured container width to the score renderer, and ensure the score container and SVG use `min-w-0` and `w-full` so the SVG width never exceeds the container's `clientWidth` on narrow mobile screens (~320px).
  - Ensure the score renderer's available-width calculation respects small container widths without forcing a wider minimum than the container provides.

- **Progressive 4 → 3 → 2 → 1 Responsive Columns & Safe Manual Override**:
  - Update the score renderer's automatic `measuresPerSystem` breakpoints to step progressively:
    - `width >= 960` → `4` measures per row
    - `width >= 720` → `3` measures per row
    - `width >= 460` → `2` measures per row
    - `width < 460` → `1` measure per row
  - Update the **Reading View** header column selector to offer `Auto`, `1`, `2`, `3`, and `4`, with `Auto` selected by default (`undefined` override).
  - When a manual column count is selected, clamp the effective `measuresPerSystem` passed to the renderer to at most the automatic column limit for the current container width so narrow viewports never overflow horizontally.

- **Extended Bar Counts in Procedural Generator**:
  - Expand the Procedural Generator bar-count button group in the reading training controls from `[4, 8, 16]` to `[4, 8, 16, 32, 48, 64]`, keeping `4` as the initial default and rendering all measures continuously in **Reading View** without pagination.

- **Window-Level Auto-Scroll Toggle & Manual-Scroll Disengagement**:
  - Add an `Auto-scroll` toggle button to the **Reading View** header bar, visible across all screen sizes (including mobile), initialized to `OFF` (`false`).
  - When `Auto-scroll` is `ON` and playback is active, check the vertical bounds of the active system row / **Playhead** only when the active measure (or system row) changes—not on every `requestAnimationFrame` tick—and smoothly scroll the browser window (`window.scrollTo` / `scrollIntoView`) only when the active row falls outside or near the edge of the visible viewport.
  - Track programmatic auto-scrolls briefly (or distinguish user-initiated `wheel`, `touchmove`, and non-programmatic `scroll` events) so that any manual user scroll while `Auto-scroll` is `ON` immediately turns `Auto-scroll` `OFF`.

## Testing Decisions

- **What Makes a Good Test**:
  - Assert externally observable behavior: rendered SVG dimensions and measure grouping (`g.vf-stavenote` / barlines per system row), DOM geometry (`scrollWidth <= clientWidth`, absence of `max-h-*` / internal scroll containers), button states, generated measure counts, and window scroll invocation / toggle disengagement—not internal state variable names or CSS class internals where behavior can be verified directly.
- **Modules & Seams to Test**:
  - **Score Renderer Seam**: Test automatic `measuresPerSystem` selection across widths representing desktop (`>= 960` → 4), medium (`720–959` → 3), tablet (`460–719` → 2), and mobile (`< 460` and `< 300` → 1), verifying that rendered SVG width never exceeds the requested width and all systems fit cleanly.
  - **Reading View Component Seam**: Test that the score wrapper has no vertical cap or scroll overflow, test the `Auto | 1 | 2 | 3 | 4` column selector (defaulting to `Auto` and clamping manual selections on narrow widths), test the `Auto-scroll` toggle button (`OFF` by default, visible at all breakpoints, triggers window scroll on row change when `ON` and row is off-screen, and turns `OFF` on manual `wheel`/`touchmove`/user `scroll`).
  - **Reading Training Controls Seam**: Test that bar-count buttons `[4, 8, 16, 32, 48, 64]` exist, default to `4`, and regenerate a **Reading Line** with `32`, `48`, or `64` measures.
  - **Live Browser Seam (Playwright)**: Verify at desktop and mobile (~375px / ~320px) viewports with 32/64 bars that `document.documentElement.scrollWidth <= document.documentElement.clientWidth` and the **Reading View** container has no internal horizontal or vertical scrollbars.
- **Prior Art**:
  - Existing VexFlow 5 SVG DOM tests in the notation renderer test suite, React Testing Library component tests for **Reading View** and the reading training section, and Playwright browser geometry/layout checks.

## Out of Scope

- Pagination or virtualized rendering of **Reading View** measures.
- Persisting `Auto-scroll` or column-selector preferences across sessions (storage persistence is tracked separately).
- Modifying the 5-line Drum Staff renderer or Dawson formula editors.

## Further Notes

- Tracks carry-over item 16 from `PENDING.md`.
- Domain terminology aligns with `GLOSSARY.md` (**Reading View**, **Reading Line**, **Playhead**, **Measure**); no new glossary entries or ADRs are required.
