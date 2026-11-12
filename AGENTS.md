# Agent Instructions

## Hard constraints

**NEVER spawn subagents.** Do not use the subagent/agent-spawning tool under any circumstances, including exploration, research, or parallel work. This is due to memory constraints on this machine (running on local models such as strata qwen 3.8 flash next). Explore and reason directly with the file, grep, and shell tools instead.

When a skill (implement-spec, code-review) orchestrates subagents/worktrees, run its steps inline on the integration branch in the main worktree: one seam, one red→green slice, one commit per ticket.

## Matt Pocock Engineering Flow (Strict)

When driving work via Matt Pocock skills, ALWAYS respect the phase boundaries in order:
1. **`/grill-with-docs`**: Interview and domain doc sync (`GLOSSARY.md`, ADRs) ONLY. **NEVER modify or write production code during or immediately upon concluding grilling.** When unattended, drill yourself: pose each question, answer it from the code and repo docs, record the settled decision — never idle on unanswered questions.
2. **`/to-spec`**: Synthesizes the settled decisions into a formal spec.
3. **`/to-tickets`**: Breaks the spec into tracer-bullet vertical slices with explicit blocking edges. Slices must land green on their own (respecting compilation/consumer boundaries during retirements).
4. **`/implement`**: Implements ticket-by-ticket driving **`/tdd`** (one seam, one red-green-refactor slice, one commit per ticket). Verify a clean working tree before checking out an integration branch.
5. **`/code-review`**: Runs the two-axis review (Standards + Spec) on the resulting diff, then fixes the findings it raises.
6. **`/retro`**: Retrospective on the finished candidate (navigation, automated checks, coding standards, AGENTS.md, tool economy, no-ops, information access).
7. **Apply findings**: Land the retro's actionable findings into the steering docs (`AGENTS.md`, `CODING_STANDARDS.md`, `GLOSSARY.md`, ADRs, checks) immediately — a retro whose findings are not applied is wasted.

Skipping phases or jumping from grilling directly into bulk code implementation is strictly forbidden.

### Architecture Review Batch Execution

When instructed to work through the architecture review candidates:
Process each candidate from the HTML review report located in `.scratch/` (e.g. `.scratch/architecture-review-*.html`) one by one in sequence, following the full Matt Pocock Engineering Flow above (phases 1–7) per candidate: grill-and-answer (docs only), spec, tickets, implement via TDD, code-review and fix, retro, apply findings. Then **`/clear`** context and start the next candidate from a clean window. Repeat until all candidates defined in the HTML review in `.scratch/` are completed.

## Skills

Every skill lives in `.agents/skills/<name>/SKILL.md` (with support docs alongside it, e.g. `tests.md`, `ADR-FORMAT.md`). If the skill tool cannot resolve a name, read its `SKILL.md` directly from that folder and follow it inline — the skills there are the source of truth and every one of them can be invoked from disk.

## Shell

Commands run in PowerShell on Windows — use PowerShell idioms (`Get-Content`, `Select-String`, `Remove-Item`); the grep/glob tools cover content search, so reach for the shell only for test/build runs and file ops.

During TDD slices, run targeted test files (`npx vitest run <file>`) for rapid red/green feedback; the git pre-commit hook automatically verifies full `npm run check` on each ticket commit.

Sweep the repo for style drift with `npm run check:style` and read the theme's token budget with `npm run check:tokens`; hand-built PowerShell regex sweeps fight the harness's command scanner and the old PowerShell parser.

In `npm run check` output, jsdom `Error: Not implemented: navigation` and React `act()` warnings are benign test noise — trust the pass summary and exit code, don't chase them.

## Browser testing

You **have vision**: take screenshots of the running app with Playwright and look at them — for visual surfaces (the pentagram, VexFlow renders, playhead geometry) a screenshot check is often the fastest way to see what is wrong. Combine both: read the rendered SVG/DOM geometry programmatically for precise assertions, look at screenshots for gestalt judgment. A visual defect that only DOM assertions would catch is still a defect to catch with a geometry assertion.

## E2E tests

Rich end-to-end tests are valuable and expected — especially for the interactive surfaces: composing formulas in the partiture editors, selecting/composing ostinatos, tap-tempo, tempo ramps, mixer gestures. This app is **visual and interactive**: many features (stave geometry, playhead alignment, editor gestures, drag-and-drop) are genuinely hard to test at unit or integration level, so do not enforce the test pyramid here — **e2e coverage should span a large number of features**, not a token few. Drive them through the highest seam available (a real browser via Playwright when jsdom falls short, the component + domain seams through jsdom when it does not), exercising full user journeys from realistic inputs to observable outcomes (audio events scheduled, notation rendered, state persisted), not just unit-level plumbing. A rich e2e suite is the regression net that lets an unattended agent trust its own work.

## Agent skills

### Issue tracker

Specs, tracer-bullet tickets, and the repo-root `PENDING.md` carry-over list. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles mapped 1:1 (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.

## Navigation

- **Dawson Orchestration**: UI entry point in `src/components/DawsonOrchestrationSection.tsx`, modal/canvas formula editors in `src/components/dawson/`, domain models/presets in `src/domain/dawson/`.
- **Notation Renderers**: Drum staff formula renderer in `src/notation/DrumStaffFormulaRenderer.ts`, reading score in `src/notation/ReadingScoreRenderer.ts`.

## Telegram Alerts

Run `notify.sh` through Git's bash in scanner-safe `cmd /c` form (the PowerShell call-operator form trips the harness's command scanner; `./notify.sh` alone and `bash ./notify.sh` both fail):
`cmd /c '"C:\Program Files\Git\bin\bash.exe" ./notify.sh "<msg>"'` ONLY when:
- Done: message `"Done: <one-sentence summary>"`
- Blocked/Question: message `"Question: <short question>"`