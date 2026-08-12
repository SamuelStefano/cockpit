// Smoke do link compartilhável do /play: editar código + trocar linguagem, clicar
// no botão de link, ler a URL da área de transferência e reabri-la numa aba limpa —
// o código e a linguagem têm que voltar idênticos (badge "aberto de link").
// Roda contra `vite preview` (build estático), sem backend.
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1; };

const browser = await chromium.launch();
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const marker = `SMOKE_${Date.now()}`;

try {
  await page.goto(`${BASE}/play`, { waitUntil: 'networkidle', timeout: 20000 });
  ok('/play carrega');

  // Troca pra SVG (linguagem ≠ default) e injeta um marcador único no editor —
  // prova que tanto o código quanto a linguagem escolhida entram no link.
  await page.getByRole('button', { name: 'SVG' }).click();
  await page.waitForTimeout(400);
  const ta = page.locator('textarea').first();
  await ta.focus();
  await ta.fill(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="8" y="52" id="${marker}">oi</text></svg>`);
  await page.waitForTimeout(400);

  // Clica no botão de link e lê a URL da área de transferência.
  await page.getByTitle('Copiar link compartilhável').click();
  await page.waitForTimeout(300);
  const url = await page.evaluate(() => navigator.clipboard.readText());
  if (!url || !url.includes('/play#c=')) throw new Error(`clipboard não trouxe um link /play#c= — "${String(url).slice(0, 80)}"`);
  ok(`link copiado pra área de transferência (${url.slice(0, 42)}…)`);

  // Reabre numa aba nova (contexto novo, sem estado em memória).
  const fresh = await context.newPage();
  fresh.on('pageerror', (e) => errors.push(String(e)));
  await fresh.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  await fresh.waitForTimeout(500);

  // (1) badge "aberto de link" confirma que a página entrou no modo compartilhado.
  if (await fresh.locator('text=aberto de link').count()) ok('badge "aberto de link" aparece ao abrir o permalink');
  else fail('badge "aberto de link" não apareceu');

  // (2) linguagem restaurada — a aba SVG volta ativa (acento laranja).
  const svgClass = (await fresh.getByRole('button', { name: 'SVG' }).getAttribute('class')) ?? '';
  if (svgClass.includes('text-orange-200')) ok('linguagem SVG restaurada como aba ativa');
  else fail(`aba SVG não voltou ativa — class="${svgClass.slice(0, 80)}"`);

  // (3) código restaurado — o editor traz o mesmo marcador que digitamos.
  const restored = await fresh.locator('textarea').first().inputValue();
  if (restored.includes(marker)) ok(`código restaurado idêntico no editor (achou "${marker}")`);
  else fail(`editor não trouxe o código do link — "${restored.slice(0, 80)}"`);

  // (4) e roda de verdade: o SVG do link vira um <svg> no iframe sandbox.
  await fresh.waitForSelector('iframe[title="live preview"]', { timeout: 10000 });
  await fresh.waitForTimeout(900);
  const svgCount = await fresh.frameLocator('iframe[title="live preview"]').first().locator('svg').count();
  if (svgCount > 0) ok('preview do permalink renderiza o <svg> compartilhado');
  else fail('preview do permalink não renderizou nenhum <svg>');

  if (errors.length) fail(`erros de página: ${errors.slice(0, 3).join(' | ')}`);
  else ok('sem erros de página não tratados');
} catch (e) {
  fail(`exceção no smoke: ${e.message}`);
} finally {
  await browser.close();
}

console.log(process.exitCode ? '\nSMOKE FALHOU' : '\nSMOKE OK');
