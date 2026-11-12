# Agent Instructions

## Hard constraints

<!-- Subagents constraint: active only when running on local models (e.g. strata qwen 3.8 flash next) due to local machine RAM limits. Disabled for cloud models (Gemini).
**NEVER spawn subagents.** Do not use the subagent/agent-spawning tool under any circumstances, including exploration, research, or parallel work. This is due to memory constraints on this machine. Explore and reason directly with the file, grep, and shell tools instead.

When a skill (implement-spec, code-review) orchestrates subagents/worktrees, run its steps inline on the integration branch in the main worktree: one seam, one red→green slice, one commit per ticket.
-->

## Matt Pocock Engineering Flow (Strict)

When driving work via Matt Pocock skills, ALWAYS respect the phase boundaries in order:
1. **`/grill-with-docs`**: Interview and domain doc sync (`GLOSSARY.md`, ADRs) ONLY. **NEVER modify or write production code during or immediately upon concluding grilling.**
2. **`/to-spec`**: Synthesizes the settled decisions into a formal spec.
3. **`/to-tickets`**: Breaks the spec into tracer-bullet vertical slices with explicit blocking edges. Slices must land green on their own (respecting compilation/consumer boundaries during retirements).
4. **`/implement`**: Implements ticket-by-ticket driving **`/tdd`** (one seam, one red-green-refactor slice, one commit per ticket). Verify a clean working tree before checking out an integration branch.
5. **`/code-review`**: Runs the two-axis review (Standards + Spec) on the resulting diff.

Skipping phases or jumping from grilling directly into bulk code implementation is strictly forbidden.

## Shell

Commands run in PowerShell on Windows — use PowerShell idioms (`Get-Content`, `Select-String`, `Remove-Item`); the grep/glob tools cover content search, so reach for the shell only for test/build runs and file ops.

During TDD slices, run targeted test files (`npx vitest run <file>`) for rapid red/green feedback; the git pre-commit hook automatically verifies full `npm run check` on each ticket commit.

Sweep the repo for style drift with `npm run check:style` and read the theme's token budget with `npm run check:tokens`; hand-built PowerShell regex sweeps fight the harness's command scanner and the old PowerShell parser.

In `npm run check` output, jsdom `Error: Not implemented: navigation` and React `act()` warnings are benign test noise — trust the pass summary and exit code, don't chase them.

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