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
// The eager graph of a session measured at this seam: two audible rigs at the voice-pool
// width cost 4,673 Gain nodes at page load (the pre-candidate baseline, docs/adr/0011). The
// budget leaves ~7% slack above that; the doubled graph that made Chrome refuse cost 13,049.
const NODE_BUDGET = 5000;
const BENIGN_CONSOLE = /vite|Download the React DevTools|Tone\.js v\d+|was not allowed to start/i;

function bootVite() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--host', '127.0.0.1'],
      { cwd: process.cwd() },
    );
    let output = '';
    let served = false;
    // The watchdog must not keep the process alive once vite has served.
    const watchdog = setTimeout(
      () => { if (!served) reject(new Error('vite did not serve in time')); },
      30000,
    );
    const exited = new Promise((done) => child.once('exit', () => done()));
    child.stdout.on('data', (chunk) => {
      if (served) return;
      // vite paints the URL with ANSI codes between the host and the port.
      output += chunk;
      const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
      if (clean.search(new RegExp('http://(?:localhost|127\\.0\\.0\\.1):' + PORT)) >= 0) {
        served = true;
        clearTimeout(watchdog);
        resolve({ child, exited });
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!served) reject(new Error('vite exited ' + code));
    });
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

  // The app's own tempo readout: the big number in the Metronome card, beside the BPM label.
  const configuredBpm = await page.evaluate(() => {
    const unit = Array.from(document.querySelectorAll('span')).find((s) => (s.textContent || '').trim() === 'BPM');
    if (!unit || !unit.previousElementSibling) return null;
    const value = Number((unit.previousElementSibling.textContent || '').trim());
    return Number.isFinite(value) && value > 0 ? value : null;
  });

  const startBtn = (await page.locator('button').filter({ hasText: /start clock/i })).first();
  await startBtn.click();

  // The page counts its own beat changes. Sampling the DOM from here would undercount:
  // an evaluate round-trip can span two beats, and a lost beat is a flaky guard, not a
  // stalled clock. The observer watches the Beat: readout's own subtree.
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('span')).filter((s) => (s.textContent || '').trim() === 'Beat:');
    const value = labels.length ? labels[0].nextElementSibling : null;
    if (!value) return;
    window.__beatCount = 0;
    window.__lastBeat = (value.textContent || '').trim();
    const observer = new MutationObserver(() => {
      const text = (value.textContent || '').trim();
      if (text !== window.__lastBeat) {
        window.__lastBeat = text;
        window.__beatCount++;
      }
    });
    observer.observe(value, { characterData: true, childList: true, subtree: true });
    window.__beatWatched = true;
  });

  const sampledAt = Date.now();
  await page.waitForTimeout(RUN_MS);
  const elapsedSeconds = (Date.now() - sampledAt) / 1000;

  const beatWatched = await page.evaluate(() => window.__beatWatched === true);
  const beatChanges = await page.evaluate(() => window.__beatCount ?? 0);
  const after = await page.evaluate(() => ({ census: window.__census, errors: window.__errors }));
  const started = after.census.sourceStart || 0;
  await browser.close();
  vite.child.kill();
  await vite.exited;

  const failures = [];
  const expectedBeats = configuredBpm === null ? 0 : (elapsedSeconds * configuredBpm) / 60;
  console.log('gains at load: ' + gainsAtLoad + ' (budget ' + NODE_BUDGET + ')');
  console.log('configured tempo read from the page: ' + configuredBpm + ' bpm');
  console.log('beats heard: ' + beatChanges + ' (expected ~' + expectedBeats.toFixed(1) + ')');
  console.log('source starts: ' + started);
  if (gainsAtLoad > NODE_BUDGET) {
    failures.push('the eager audio graph cost ' + gainsAtLoad + ' Gain nodes at page load, over the ' + NODE_BUDGET + ' budget');
  }
  if (configuredBpm === null) {
    failures.push('the configured tempo could not be read from the page, so the cadence cannot be checked');
  } else if (beatChanges < expectedBeats * 0.75) {
    failures.push('the audio clock delivered ' + beatChanges + ' beats in ' + elapsedSeconds.toFixed(1) + 's while ' + configuredBpm + ' bpm asks for ~' + expectedBeats.toFixed(1));
  }
  if (!beatWatched) failures.push('no beat readout was found to watch: the cadence cannot be checked');
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
