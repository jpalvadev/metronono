# 08: One-style invariant sweep and verify

**What to build:** The whole app is provably one style: a repo-wide scan of components finds zero raw palette references (`teal-`, `rose-`, `amber-`, `emerald-`, `slate-`, `bg-black`, `text-white`, `bg-white`, `dark:` prefixes) and zero `rgba(` color literals; the theme stylesheet and Tailwind config contain only the consumed token set; and the full guardrail passes. This is the integrate-and-verify ticket — it confirms the invariant end to end after every surface landed.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07.

**Status:** resolved

- [x] Repo-wide scan over components: zero raw palette class references, zero `dark:` variants, zero inline glow literals
- [x] Theme stylesheet declares no unused tokens (no chart ramp, no sidebar block, no dark block)
- [x] Tailwind build emits no unresolved style warnings
- [x] `npm run check` (`tsc --noEmit && vitest run`) green, all suites including the new token-role assertions
- [x] Visual sanity: one Accent, three Status Colors, one Modal Scrim on all three modals, one Playhead color in every view

## Answer

Sweep over the 50 component sources under `src/`: zero `teal-`/`rose-`/`amber-`/`emerald-`/`slate-`/`purple-` palette classes, zero `bg-white`/`text-white`/`bg-black`, zero `dark:` variants, zero `rgba(` literals (the only remaining hits are the guard regexes inside `__tests__`). Theme audit: `src/index.css` has no `.dark` block, no `--chart-*`, no `--sidebar-*`; every declared token is consumed by a class or a `var()`, and no role class is used-but-undeclared. Tailwind build (`npx tailwindcss -i src/index.css -o <tmp> --minify`) exits 0 with zero unresolved-style warnings and keeps exactly one `.modal-scrim` and one `.playhead-glow`; the deprecated `darkMode: false` key (v3.4 treats it as `media` and warns on it) was removed, so the `dark:`-free invariant rests on the sweep plus the suite assertions. Class-level sanity: Accent `bg-primary playhead-glow` on both canvas Playheads and the notation overlay, `modal-scrim` on all three modals, Success/Warning/Destructive used across views. `npm run check` green: 36 test files, 386 tests, exit 0. Done in commit "style(theme): drop deprecated darkMode key, one-style invariant verified (ticket 08)" (7f04c8e).

## Comments
