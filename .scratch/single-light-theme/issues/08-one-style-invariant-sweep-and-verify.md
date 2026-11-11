# 08: One-style invariant sweep and verify

**What to build:** The whole app is provably one style: a repo-wide scan of components finds zero raw palette references (`teal-`, `rose-`, `amber-`, `emerald-`, `slate-`, `bg-black`, `text-white`, `bg-white`, `dark:` prefixes) and zero `rgba(` color literals; the theme stylesheet and Tailwind config contain only the consumed token set; and the full guardrail passes. This is the integrate-and-verify ticket — it confirms the invariant end to end after every surface landed.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07.

**Status:** ready-for-agent

- [ ] Repo-wide scan over components: zero raw palette class references, zero `dark:` variants, zero inline glow literals
- [ ] Theme stylesheet declares no unused tokens (no chart ramp, no sidebar block, no dark block)
- [ ] Tailwind build emits no unresolved style warnings
- [ ] `npm run check` (`tsc --noEmit && vitest run`) green, all suites including the new token-role assertions
- [ ] Visual sanity: one Accent, three Status Colors, one Modal Scrim on all three modals, one Playhead color in every view

## Comments
