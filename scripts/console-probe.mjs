// Reproduction probe: drives the live app in a real browser and reports console
// messages (with stacks), page errors, the WebAudio node census, per-callsite
// node counts, and playhead/beat telemetry while the clock runs.
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:5175/';
const RUN_MS = Number(process.argv[3] || 8000);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 1500 } });

  await page.addInitScript(() => {
    Error.stackTraceLimit = 200;
    window.__probeLogs = [];
    window.__playing = false;
    const record = (type, text) => {
      if (window.__probeLogs.length >= 400) return;
      let stack = '';
      try { stack = new Error().stack || ''; } catch (e) {}
      window.__probeLogs.push({ type, text, stack });
    };
    for (const m of ['log', 'warn', 'error']) {
      const orig = console[m];
      try {
        console[m] = (...args) => {
          record(m, args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
          orig(...args);
        };
      } catch (e) {}
    }
    window.__census = {};
    window.__sites = {};
    window.__loadFrames = {};
    window.__playFrames = {};
    window.__patched = [];
    const startProtos = [];
    if (window.OscillatorNode && window.OscillatorNode.prototype) startProtos.push(window.OscillatorNode.prototype);
    if (window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype) startProtos.push(window.AudioBufferSourceNode.prototype);
    for (const p of startProtos) {
      const origStart = p.start;
      if (!origStart) continue;
      try {
        p.start = function (...args) {
          window.__census['sourceStart'] = (window.__census['sourceStart'] || 0) + 1;
          return origStart.apply(this, args);
        };
        window.__patched.push('sourceStart');
      } catch (e) {}
    }
    const proto = window.AudioContext && window.AudioContext.prototype;
    if (proto) {
      for (const m of ['createGain', 'createBufferSource', 'createBuffer', 'createOscillator']) {
        const orig = proto[m];
        if (!orig) continue;
        try {
          proto[m] = function (...args) {
            window.__census[m] = (window.__census[m] || 0) + 1;
            let site = 'unknown';
            try {
              const raw = new Error().stack || '';
              const frames = raw.split('\n').slice(2, 8);
              site = frames.map((f) => f.trim().replace(/^at\s+/, '').replace(/\s*\(?https?:\/\/[^)\s]*\/([^/\s)]+)\)?/, '$1')).join(' <= ').slice(0, 220);
            } catch (e) {}
            const key = m + ' :: ' + site;
            window.__sites[key] = (window.__sites[key] || 0) + 1;
            try {
              const raw = new Error().stack || '';
              const bucket = window.__playing ? window.__playFrames : window.__loadFrames;
              for (const f of raw.split('\n')) {
                if (f.indexOf('/src/') >= 0) {
                  const name = f.trim().replace(/^at\s+/, '').replace(/\s+https?:\/\/.*$/, '');
                  bucket[name] = (bucket[name] || 0) + 1;
                }
              }
            } catch (e) {}
            return orig.apply(this, args);
          };
          window.__patched.push(m);
        } catch (e) {}
      }
    }
  });

  const errors = [];
  const consoleEvents = [];
  page.on('console', (msg) => {
    try {
      consoleEvents.push(`[${msg.type()}] ${msg.text()}`);
    } catch (e) {
      try {
        consoleEvents.push(`[${msg.type}] ${msg.text}`);
      } catch (e2) {
        consoleEvents.push('[console event]');
      }
    }
  });
  page.on('pageError', (err) => errors.push('PAGEERROR: ' + (err.message || err.text || err.name || String(err))));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => window.__census);

  const startBtn = (await page.locator('button').filter({ hasText: /start clock/i }).first());
  await startBtn.click();
  await page.evaluate(() => { window.__playing = true; return 1; });

  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < RUN_MS) {
    const snap = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="playhead-cursor"]');
      const spans = Array.from(document.querySelectorAll('span'))
        .filter((s) => /^\d+(\s*\/\s*\d+)?$/.test((s.textContent || '').trim()))
        .map((s) => s.textContent.trim());
      return {
        cursor: el ? el.style.left + '|' + el.style.width : 'MISSING',
        indicators: spans.join(' '),
        census: window.__census,
      };
    });
    samples.push(`${Date.now() - t0}ms beats=${snap.indicators} cursor=${snap.cursor} gains=${snap.census.createGain || 0} sources=${snap.census.createBufferSource || 0}`);
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: '.scratch/live-app-probe.png', fullPage: true });

  const report = await page.evaluate(() => ({
    logs: window.__probeLogs,
    census: window.__census,
    sites: window.__sites,
    loadFrames: window.__loadFrames,
    playFrames: window.__playFrames,
    patched: window.__patched,
  }));

  console.log('PATCHED: ' + JSON.stringify(report.patched));
  console.log('CENSUS BEFORE CLICK: ' + JSON.stringify(before));
  console.log('CENSUS AFTER: ' + JSON.stringify(report.census));
  console.log('TOP NODE SITES: ');
  const sites = Object.entries(report.sites).sort((a, b) => b[1] - a[1]).slice(0, 14);
  for (const [k, v] of sites) console.log(v + '  ' + k);
  console.log('APP FRAMES AT PAGE LOAD: ');
  const frames = Object.entries(report.loadFrames).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [k, v] of frames) console.log(v + '  ' + k);
  console.log('APP FRAMES DURING PLAYBACK (per-beat churn): ');
  const play = Object.entries(report.playFrames).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [k, v] of play) console.log(v + '  ' + k);
  console.log('PAGE ERRORS: ');
  for (const e of errors) console.log(e.slice(0, 500));
  console.log('BROWSER CONSOLE EVENTS (renderer errors show up here): ');
  const seenEvent = new Set();
  for (const c of consoleEvents) {
    if (seenEvent.has(c)) continue;
    seenEvent.add(c);
    console.log(c.slice(0, 300));
  }
  console.log('ALL LOGS (unique): ');
  const seen = new Set();
  for (const l of report.logs) {
    if (seen.has(l.text)) continue;
    seen.add(l.text);
    console.log(l.type + ' :: ' + l.text.slice(0, 200) + (l.stack ? ' <<STACK>> ' + String(l.stack).split('\n').slice(1, 10).join(' | ').slice(0, 900) : ''));
  }
  console.log('TELEMETRY: ');
  for (const s of samples) console.log(s);
  await browser.close();
})().catch((e) => {
  console.error('ERR ' + e);
  process.exit(1);
});
