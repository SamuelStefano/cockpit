// Visualizador: abre uma rota num browser headless e salva PNG + erros de console.
// Serve pra eu (agente) VER a tela em vez de deduzir do código — screenshot é a
// única forma de pegar bug visual (contraste, overflow, elemento sumido).
//
//   node scripts/shot.mjs /play --out /tmp/play.png
//   node scripts/shot.mjs /play --click "App" --click "Modal" --wait 1200 --vp 1440x900
//
// Roda contra `vite preview` (SMOKE_BASE) ou qualquer base via env.
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const route = args[0]?.startsWith('/') ? args[0] : '/';
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const flagAll = (name) => args.reduce((acc, a, i) => (a === `--${name}` ? [...acc, args[i + 1]] : acc), []);

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const out = flag('out', '/tmp/deck-shot.png');
const wait = Number(flag('wait', 1200));
const [w, h] = (flag('vp', '1440x900')).split('x').map(Number);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console.error: ${m.text().slice(0, 200)}`));

try {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
  for (const label of flagAll('click')) {
    await page.getByRole('button', { name: label, exact: false }).first().click({ timeout: 5000 });
    await page.waitForTimeout(400);
  }
  if (flag('fill')) await page.locator('textarea').first().fill(flag('fill'));
  await page.waitForTimeout(wait);
  const el = flag('el');
  if (el) await page.locator(el).first().screenshot({ path: out });
  else await page.screenshot({ path: out, fullPage: flag('full') !== undefined });
  console.log(`shot: ${out}`);
  console.log(problems.length ? `problemas:\n  ${problems.join('\n  ')}` : 'sem erro de console');
} catch (err) {
  console.error(`falhou: ${err.message}`);
  await page.screenshot({ path: out }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
