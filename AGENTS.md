# Agent Instructions

## Hard constraints

**NEVER spawn subagents.** Do not use the subagent/agent-spawning tool under any circumstances, including exploration, research, or parallel work. This is due to memory constraints on this machine. Explore and reason directly with the file, grep, and shell tools instead.

## Agent skills

### Issue tracker

Local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles mapped 1:1 (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.

## Telegram Alerts

Run `./notify.sh "<msg>"` ONLY when:
- Done: `./notify.sh "Done: <one-sentence summary>"`
- Blocked/Question: `./notify.sh "Question: <short question>"`