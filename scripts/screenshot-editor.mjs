import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: '.scratch/continuous-metric-timeline-candidate3.png', fullPage: true });
  console.log('SHOT OK');
})().catch((e) => {
  console.error('ERR ' + e);
  process.exit(1);
});
