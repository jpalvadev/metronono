# 03: Extended Bar Counts (32, 48, 64)

**What to build:** Expand the Procedural Generator bar-count selector in the reading training controls to include `32`, `48`, and `64` alongside `4`, `8`, and `16`, keeping `4` as the default and rendering all generated measures continuously in **Reading View**.

**Blocked by:** 01: Unbounded Reading View & Mobile Width Fit

**Status:** resolved

- [ ] Bar-count selector displays buttons for `4`, `8`, `16`, `32`, `48`, and `64`, with `4` active initially.
- [ ] Selecting `32`, `48`, or `64` generates and renders a **Reading Line** with that exact measure count.
- [ ] Component tests verify all six bar-count options and that selecting `32`, `48`, or `64` updates the rendered **Reading Line** accordingly.
