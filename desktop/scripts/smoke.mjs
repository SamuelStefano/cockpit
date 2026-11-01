import { _electron as electron } from 'playwright';

const app = await electron.launch({ args: ['.'], env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' } });
const errors = [];
const page = await app.firstWindow();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.waitForLoadState('load');
await page.waitForTimeout(5000);

const url = page.url();
const web = await page.evaluate(() => ({
  nodeRequire: typeof globalThis.require,
  nodeProcess: typeof globalThis.process,
  sw: 'serviceWorker' in navigator,
}));
// Copied first: Chromium logs its own refusal of the probe below.
const loadErrors = [...errors];
const opened = await page.evaluate(() => window.open('file:///C:/Windows/System32/calc.exe'));
const windows = app.windows().length;
await app.close();

const failures = [];
if (!url.startsWith('https://deck.devfellowship.com')) failures.push(`wrong url ${url}`);
if (web.nodeRequire !== 'undefined' || web.nodeProcess !== 'undefined') failures.push('node leaked into the page');
if (opened !== null || windows !== 1) failures.push('window.open was not denied');
if (loadErrors.length) failures.push(`console errors: ${loadErrors.join(' | ')}`);
console.log(JSON.stringify({ url, web, windows, loadErrors }, null, 2));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
