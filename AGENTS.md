# Agent Instructions

## Hard constraints

**NEVER spawn subagents.** Do not use the subagent/agent-spawning tool under any circumstances, including exploration, research, or parallel work. This is due to memory constraints on this machine. Explore and reason directly with the file, grep, and shell tools instead.

When a skill (implement-spec, code-review) orchestrates subagents/worktrees, run its steps inline on the integration branch in the main worktree: one seam, one red→green slice, one commit per ticket.

## Shell

Commands run in PowerShell on Windows — use PowerShell idioms (`Get-Content`, `Select-String`, `Remove-Item`); the grep/glob tools cover content search, so reach for the shell only for test/build runs and file ops.

Sweep the repo for style drift with `npm run check:style` and read the theme's token budget with `npm run check:tokens`; hand-built PowerShell regex sweeps fight the harness's command scanner and the old PowerShell parser.

In `npm run check` output, jsdom `Error: Not implemented: navigation` and React `act()` warnings are benign test noise — trust the pass summary and exit code, don't chase them.

## Agent skills

### Issue tracker

Specs, tracer-bullet tickets, and the repo-root `PENDING.md` carry-over list. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles mapped 1:1 (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.

## Telegram Alerts

Run `notify.sh` through Git's bash in scanner-safe `cmd /c` form (the PowerShell call-operator form trips the harness's command scanner; `./notify.sh` alone and `bash ./notify.sh` both fail):
`cmd /c '"C:\Program Files\Git\bin\bash.exe" ./notify.sh "<msg>"'` ONLY when:
- Done: message `"Done: <one-sentence summary>"`
- Blocked/Question: message `"Question: <short question>"`