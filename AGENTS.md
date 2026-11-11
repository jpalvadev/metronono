# Agent Instructions

## Hard constraints

**NEVER spawn subagents.** Do not use the subagent/agent-spawning tool under any circumstances, including exploration, research, or parallel work. This is due to memory constraints on this machine. Explore and reason directly with the file, grep, and shell tools instead.

When a skill (implement-spec, code-review) orchestrates subagents/worktrees, run its steps inline on the integration branch in the main worktree: one seam, one red→green slice, one commit per ticket.

## Shell

Commands run in PowerShell on Windows — use PowerShell idioms (`Get-Content`, `Select-String`, `Remove-Item`); the grep/glob tools cover content search, so reach for the shell only for test/build runs and file ops.

## Agent skills

### Issue tracker

Local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

`PENDING.md` at the repo root holds carry-over tickets, one line each; a done item `[ x ]` records its root cause inline, and full specs plus tracer-bullet tickets for a feature live under `.scratch/<feature>/` (`spec.md` + `issues/`).

### Triage labels

Canonical roles mapped 1:1 (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.

## Telegram Alerts

Run `notify.sh` through Git's bash in scanner-safe `cmd /c` form (the PowerShell call-operator form trips the harness's command scanner; `./notify.sh` alone and `bash ./notify.sh` both fail):
`cmd /c '"C:\Program Files\Git\bin\bash.exe" ./notify.sh "<msg>"'` ONLY when:
- Done: message `"Done: <one-sentence summary>"`
- Blocked/Question: message `"Question: <short question>"`