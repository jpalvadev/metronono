# Live browser seam

Reference for driving the running app in a real browser — the seam jsdom cannot
see (audio node budget, WebAudio renderer errors, clock cadence, editor gestures).
Read before writing a new probe or guard: the hooks and idioms below are what
`scripts/live-audio-guard.mjs` (`npm run check:live`) and `scripts/console-probe.mjs`
already use.

## What the app exposes that a browser tool can read

| Hook | Where | Use |
| --- | --- | --- |
| `data-testid="playhead-cursor"`, `measure-highlight` | `src/components/notation/PlayheadOverlay.tsx` | cursor geometry, sight-line motion |
| `data-testid="reading-view-root"`, `reading-score-container` | `src/components/notation/ReadingView.tsx` | the sight-reading system and its scroll wrapper |
| the span whose text is `Beat:` (next sibling is the 1-based beat) | `ReadingView.tsx` header | one change per beat — the cadence signal |
| the span whose text is `BPM` (previous sibling is the tempo) | `src/components/Metronome.tsx` | the configured tempo, so cadence is checked against the app, not an assumed bpm |
| the button matching `/start clock/i` | `src/components/Metronome.tsx` | the click gesture that unlocks audio |

Prefer these to new `data-testid` additions; if a needed hook is missing, add the
testid in the component, not a selector that walks the class list.

## Census and console capture

Patch prototypes with `function`, never arrow — the recorder needs `this` to call
the original. `addInitScript` runs before the app loads:

- node census: `AudioContext.prototype` — `createGain`, `createBufferSource`, `createBuffer`, `createOscillator`.
- attacks: `OscillatorNode.prototype.start` and `AudioBufferSourceNode.prototype.start`.
- console: wrap `console.log`/`warn`/`error` to record text and `new Error().stack`; renderer
  errors and Tone warnings also surface through Playwright's `page.on('console')`, whose
  handler event exposes **methods** — `msg.type()` / `msg.text()` — not properties.

## Playwright gotchas this repo keeps re-hitting

- The JS API has **no** `page.getBy...` locator helper: use
  `page.locator('button').filter({ hasText: /start clock/i }).first()`.
- `scripts/*.mjs` are plain JavaScript. A single type annotation (`const x: string[] = []`)
  throws at import, and vitest/tsc never see it — run the file with `node` to find out fast.
- Boot the server yourself so the tool is self-contained:
  `spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--host', '127.0.0.1'])`.
  vite paints the served URL **with ANSI codes inside it** (between host and port), so strip
  `\x1b\\[[0-9;]*m` before matching; with `--host 127.0.0.1` it prints `127.0.0.1`, not `localhost`.
- Release the child: clear any boot watchdog once the server serves, and await the child's
  `exit` after `kill()`, or an orphan vite keeps holding the port for the next run.
- IndexedDB is empty in a fresh browser session, so the **Sample Bank legs are dark**:
  custom sample voices never fire, and with them the accurate-timing retirement contract
  (`stop(now)`, `stoppedWithoutScheduleTime`) has no browser-side observation yet.
  Seeding a fixture sample is the open step — see `PENDING.md` item 13.

## Evidence

Screenshots go to `.scratch/*.png` and are committed as evidence (precedent:
`drum-staff-viewer-candidate2.png`, `live-app-probe.png`); read the PNG with vision,
and assert geometry programmatically for the numbers.
