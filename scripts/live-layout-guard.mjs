import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import net from 'node:net';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => resolve(addr.port));
    });
    srv.on('error', reject);
  });
}

function startVite(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--port', String(port), '--host', '127.0.0.1'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Vite boot timeout'));
    }, 15000);

    const onData = (chunk) => {
      const clean = chunk.toString().replace(/\x1b\[[0-9;]*m/g, '');
      if (clean.includes(`http://127.0.0.1:${port}`)) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
  });
}

async function stopVite(child) {
  if (!child) return;
  const exitPromise = new Promise((res) => child.once('exit', res));
  child.kill();
  await exitPromise;
}

const port = await getFreePort();
const vite = await startVite(port);
const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });

  for (const vp of [
    { width: 1280, height: 800, bars: 64, checkDoc: true },
    { width: 375, height: 667, bars: 32, checkDoc: true },
    { width: 320, height: 568, bars: 32, checkDoc: false },
  ]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.locator('button', { hasText: new RegExp(`^${vp.bars}$`) }).first().click();
    await page.waitForTimeout(250);

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const score = document.querySelector('[data-testid="reading-score-container"]');
      return {
        docScrollWidth: doc.scrollWidth,
        docClientWidth: doc.clientWidth,
        scoreScrollWidth: score?.scrollWidth ?? 0,
        scoreClientWidth: score?.clientWidth ?? 0,
        staveCount: document.querySelectorAll('[data-testid="reading-score-container"] g.vf-stave').length,
      };
    });

    if (vp.checkDoc && metrics.docScrollWidth > metrics.docClientWidth) {
      throw new Error(`Viewport ${vp.width}px horizontal overflow: ${metrics.docScrollWidth} > ${metrics.docClientWidth}`);
    }
    if (metrics.scoreScrollWidth > metrics.scoreClientWidth) {
      throw new Error(`Reading score ${vp.width}px overflow: ${metrics.scoreScrollWidth} > ${metrics.scoreClientWidth}`);
    }
    if (metrics.staveCount !== vp.bars) {
      throw new Error(`Expected ${vp.bars} staves at ${vp.width}px, got ${metrics.staveCount}`);
    }
  }

  console.log('live-layout-guard: all responsive checks passed');
} finally {
  await browser.close();
  await stopVite(vite);
}
