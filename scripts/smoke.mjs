// Smoke test E2E (Playwright). Carrega o app servido pelo Vite e confirma que a
// shell monta sem crash. Uso manual (precisa do dev rodando):
//   npm run dev        # em outro terminal (vite em 127.0.0.1:5173)
//   node scripts/smoke.mjs [url]
// Sai 0 se o app montou, 1 se quebrou. Screenshot em /tmp/deck-smoke.png.
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5173';

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 });
  await page.screenshot({ path: '/tmp/deck-smoke.png', full_page: true }).catch(() => {});
  const title = await page.title();
  const bodyText = (await page.locator('body').innerText()).slice(0, 200);
  const mounted = await page.locator('#root *').count();
  console.log(`title: ${title}`);
  console.log(`#root children: ${mounted}`);
  console.log(`body[0..200]: ${bodyText.replace(/\n/g, ' ')}`);
  if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
  if (mounted === 0) { console.error('FAIL: app did not mount'); process.exit(1); }
  console.log('OK: app mounted');
} finally {
  await browser.close();
}
