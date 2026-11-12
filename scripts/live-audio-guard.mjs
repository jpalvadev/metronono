// Live audio guard — the real-seam regression net for the audio clock.
//
// The jsdom suites record a fake Tone graph, so the breakage the user sees in a real
// browser (an audio context that falls behind the configured tempo, a WebAudio renderer
// error, a Tone accurate-timing warning, silence) only lands in CI if something drives an
// actual browser. This guard boots its own vite server, drives the app in Chromium, and
// asserts the invariants behind those symptoms:
//   1. the eager audio graph stays inside its node budget (the explosion that made Chrome
//      refuse to play anything),
//   2. the clock keeps its beat cadence at the configured tempo (a graph that is too heavy
//      falls behind and the clock seems to stop and play),
//   3. sources actually start every beat (silent clicks otherwise),
//   4. no Tone or WebAudio console error appears once the clock is running.
//
// Run: node scripts/live-audio-guard.mjs   (npm run check:live)
import { chromium } from 'playwright';
import { spawn } from 'child_process';

const PORT = 5399;
const RUN_MS = Number(process.argv[2] || 6000);
const BPM = 120;
// The eager graph of a session: two audible rigs at the voice-pool width. Chrome's WebAudio
// renderer starts refusing to play past a few thousand nodes, so the budget is pinned here.
const NODE_BUDGET = 7000;
const BENIGN_CONSOLE = /vite|Download the React DevTools|Tone\.js v\d+|was not allowed to start/i;

function bootVite() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--host', '127.0.0.1'],
      { cwd: process.cwd() },
    );
    let output = '';
    child.stdout.on('data', (chunk) => {
      // vite paints the URL with ANSI codes between the host and the port.
      output += chunk;
      const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
      if (clean.search(new RegExp('http://(?:localhost|127\\.0\\.0\\.1):' + PORT)) >= 0) resolve(child);
    });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error('vite exited ' + code)));
    setTimeout(() => reject(new Error('vite did not serve in time')), 30000);
  });
}

(async () => {
  const vite = await bootVite();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 1500 } });

  await page.addInitScript(() => {
    Error.stackTraceLimit = 100;
    window.__census = {};
    window.__errors = [];
    const proto = window.AudioContext && window.AudioContext.prototype;
    if (proto) {
      for (const m of ['createGain', 'createBufferSource', 'createOscillator', 'createBuffer']) {
        const orig = proto[m];
        if (!orig) continue;
        try {
          proto[m] = function (...args) {
            window.__census[m] = (window.__census[m] || 0) + 1;
            return orig.apply(this, args);
          };
        } catch (e) {}
      }
    }
    for (const Ctor of [window.OscillatorNode, window.AudioBufferSourceNode]) {
      const p = Ctor && Ctor.prototype;
      const origStart = p && p.start;
      if (!origStart) continue;
      try {
        p.start = function (...args) {
          window.__census.sourceStart = (window.__census.sourceStart || 0) + 1;
          return origStart.apply(this, args);
        };
      } catch (e) {}
    }
    const record = (type, text) => {
      if ((window.__errors || []).length > 200) return;
      window.__errors.push(type + ' :: ' + text);
    };
    for (const m of ['warn', 'error']) {
      const orig = console[m];
      try {
        console[m] = (...args) => {
          record(m, args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
          orig(...args);
        };
      } catch (e) {}
    }
  });

  const browserConsole = [];
  page.on('console', (msg) => {
    try {
      browserConsole.push(msg.text());
    } catch (e) {
      browserConsole.push(String(msg));
    }
  });

  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);

  const gainsAtLoad = await page.evaluate(() => window.__census.createGain || 0);

  const startBtn = (await page.locator('button').filter({ hasText: /start clock/i })).first();
  await startBtn.click();

  // The beat indicator in the sight-reading header advances once per beat.
  const readBeat = () =>
    page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('span')).filter((s) => (s.textContent || '').trim() === 'Beat:');
      if (!labels.length) return null;
      const value = labels[0].nextElementSibling;
      return value ? (value.textContent || '').trim() : null;
    });

  let beatChanges = 0;
  let previous = await readBeat();
  const sampledAt = Date.now();
  while (Date.now() - sampledAt < RUN_MS) {
    const current = await readBeat();
    if (current !== null && previous !== null && current !== previous) beatChanges++;
    if (current !== null) previous = current;
    await page.waitForTimeout(100);
  }

  const elapsedSeconds = (Date.now() - sampledAt) / 1000;
  const after = await page.evaluate(() => ({ census: window.__census, errors: window.__errors }));
  const started = after.census.sourceStart || 0;
  await browser.close();
  vite.kill();

  const expectedBeats = (elapsedSeconds * BPM) / 60;
  const failures = [];
  console.log('gains at load: ' + gainsAtLoad + ' (budget ' + NODE_BUDGET + ')');
  console.log('beats heard: ' + beatChanges + ' (expected ~' + expectedBeats.toFixed(1) + ')');
  console.log('source starts: ' + started);
  if (gainsAtLoad > NODE_BUDGET) {
    failures.push('the eager audio graph cost ' + gainsAtLoad + ' Gain nodes at page load, over the ' + NODE_BUDGET + ' budget');
  }
  if (beatChanges < expectedBeats * 0.75) {
    failures.push('the audio clock delivered ' + beatChanges + ' beats in ' + elapsedSeconds.toFixed(1) + 's while ' + BPM + ' bpm asks for ~' + expectedBeats.toFixed(1));
  }
  if (beatChanges === 0) failures.push('the beat indicator never advanced: the clock is stalled');
  if (started < beatChanges) failures.push('only ' + started + ' sources started for ' + beatChanges + ' beats: the clock beats go unheard');
  const toneErrors = after.errors.filter((line) => !BENIGN_CONSOLE.test(line));
  if (toneErrors.length) failures.push(...toneErrors);
  const rendererErrors = browserConsole.filter(
    (line) => /AudioContext encountered an error|should use the passed in scheduling time/i.test(line)
  );
  if (rendererErrors.length) failures.push(...rendererErrors);

  if (failures.length) {
    console.log('LIVE AUDIO GUARD FAILED:');
    for (const f of failures) console.log('  ' + f);
    process.exit(1);
  }
  console.log('LIVE AUDIO GUARD GREEN: cadence, attacks, and console stay clean at the browser seam');
})().catch((e) => {
  console.error('LIVE AUDIO GUARD ERROR ' + e);
  process.exit(1);
});
