// Smoke das micro-interações + theme playground na galeria /ds e das seeds
// "Gerar UI" da paleta de comandos. Roda contra `vite preview` (build estático).
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1; };

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE}/ds`, { waitUntil: 'networkidle', timeout: 20000 });
  ok('/ds carrega');

  // Seções novas presentes.
  if (await page.getByText('Micro-interações', { exact: true }).count()) ok('seção Micro-interações presente');
  else fail('seção Micro-interações ausente');
  if (await page.getByText('Theme playground — acento ao vivo', { exact: true }).count()) ok('seção Theme playground presente');
  else fail('seção Theme playground ausente');

  // Confetti: clicar dispara peças .confetti-pc no overlay global.
  await page.getByRole('button', { name: 'Soltar confetti' }).click();
  await page.waitForTimeout(300);
  const confetti = await page.locator('.confetti-pc').count();
  if (confetti > 0) ok(`confetti disparou (${confetti} peças)`);
  else fail('confetti não gerou peças');

  // Ripple: pointer down no botão cria .ripple-ink efêmero.
  const rippleBtn = page.getByRole('button', { name: 'Com ripple' });
  const box = await rippleBtn.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(80);
  const ink = await page.locator('.ripple-ink').count();
  await page.mouse.up();
  if (ink > 0) ok('ripple criou tinta no clique');
  else fail('ripple não apareceu');

  // pulse-ring presente na demo.
  if (await page.locator('.pulse-ring').count()) ok('pulse-ring renderiza');
  else fail('pulse-ring ausente');

  // Theme playground: mover matiz reescreve --accent no :root.
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  const hue = page.locator('input[type=range]').first();
  await hue.focus();
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  if (after && after !== before) ok(`theme playground mudou --accent (${before || 'default'} → ${after})`);
  else fail(`--accent não mudou (${before} → ${after})`);

  // Reset restaura o padrão laranja.
  await page.getByRole('button', { name: 'restaurar padrão' }).click();
  await page.waitForTimeout(120);

  // Paleta: seeds "Gerar UI" aparecem ao buscar.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.getByRole('button', { name: 'Comandos (⌘K)' }).click();
  await page.waitForSelector('[role=dialog]', { timeout: 5000 });
  await page.getByPlaceholder(/Buscar comando/).fill('Gerar UI');
  await page.waitForTimeout(200);
  const seeds = await page.locator('[role=dialog] button').getByText(/Gerar UI:/).count();
  if (seeds >= 3) ok(`paleta mostra ${seeds} seeds de Gerar UI`);
  else fail(`seeds de Gerar UI não apareceram (${seeds})`);

  // Selecionar um seed pré-preenche o composer com o prompt ```preview.
  await page.getByRole('button', { name: /Gerar UI: landing page/ }).click();
  await page.waitForTimeout(250);
  const values = await page.locator('textarea').evaluateAll((els) => els.map((e) => e.value));
  const seeded = values.some((v) => v.includes('```preview'));
  if (seeded) ok('seed pré-preenche o composer com bloco preview');
  else fail(`composer não recebeu o prompt do seed (${JSON.stringify(values.map((v) => v.slice(0, 30)))})`);

  if (!errors.length) ok('sem erros de página');
  else fail(`erros de página: ${errors.join(' | ')}`);
} catch (e) {
  fail(`exceção: ${e.message}`);
} finally {
  await browser.close();
}

console.log(process.exitCode ? '\nSMOKE-DS: FALHOU' : '\nSMOKE-DS: OK');
