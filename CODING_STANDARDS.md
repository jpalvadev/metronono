# Coding Standards

Read during review (`/code-review` Standards axis). Each rule is labelled hard or judgement call.

## Notation renderers (judgement call)

A renderer test must assert against the rendered SVG DOM (barlines, noteheads, clefs) for behaviour the user sees — not only the returned `ScoreLayout` object. Layout assertions alone pass while the canvas stays blank or degenerate (e.g. VexFlow stave barlines collapse to invisible 1px rects on a 1-line stave).

## Checks

`npm run check` (`tsc --noEmit && vitest run`) is the repo's guardrail, enforced on `main` by CI (`.github/workflows/check.yml`). Diff review should confirm the changed files pass it; run it rather than assuming.
