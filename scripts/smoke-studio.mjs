// Smoke da headline "Studio": /ds precisa (1) re-renderizar a tela ao digitar no
// editor, (2) capturar console.* do sandbox no painel, (3) trocar viewport, (4)
// abrir tela cheia. Roda contra `vite preview` (build estático) — sem backend.
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
  await page.waitForSelector('iframe[title="live preview"]', { timeout: 15000 });

  // Escopa no PRIMEIRO card (react) — /ds tem dois LivePreview (react + nativo),
  // então controles se repetem. Sem escopo, `.first()` pega o botão errado.
  // Usa o label da barra (estável) e NÃO o iframe: na aba código o iframe some.
  const card = page.locator('div.my-1').filter({ hasText: 'live preview' }).first();
  ok('/ds renderiza o card do Studio com iframe sandbox');

  const frame = page.frameLocator('iframe[title="live preview"]').first();
  await frame.locator('body').waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  ok('iframe sandbox executou o código do assistente');

  // (1) EDITÁVEL — abre a aba "código", troca o código inteiro por um marcador
  // único + console.log, confirma que a tela re-renderiza (prova o loop
  // editar→transpilar→postMessage→render). name exato pra não pegar "tela cheia".
  await card.getByRole('button', { name: 'código', exact: true }).click();
  const ta = card.locator('textarea');
  await ta.waitFor({ timeout: 5000 });
  const marker = `SMOKE_${Date.now()}`;
  await ta.focus();
  await ta.fill(
    `export default function App(){\n  console.log('${marker}-log');\n  return <div style={{padding:24,fontSize:22,color:'#f97316'}}>${marker}</div>;\n}`
  );
  await page.waitForTimeout(700);
  await card.getByRole('button', { name: 'tela', exact: true }).click();
  await page.waitForTimeout(600);
  const shown = await frame.locator('body').innerText().catch(() => '');
  if (shown.includes(marker)) ok(`digitar re-renderiza a tela ao vivo (achou "${marker}")`);
  else fail(`tela não refletiu a edição — innerText="${shown.slice(0, 80)}"`);

  // (2) CONSOLE — abre o painel e confirma o log capturado do sandbox.
  await card.getByTitle('Console').click();
  await page.waitForTimeout(400);
  const cardText = await card.innerText();
  if (cardText.includes(`${marker}-log`)) ok('console.* do sandbox capturado no painel');
  else fail(`log do sandbox não apareceu no painel — card="${cardText.slice(0, 120)}"`);

  // (3) VIEWPORT — troca pra "mobile" (moldura de largura fixa).
  const mobileBtn = card.getByTitle('Mobile');
  if (await mobileBtn.count()) {
    await mobileBtn.click();
    await page.waitForTimeout(300);
    ok('switcher de viewport respondeu (mobile)');
  } else {
    fail('botão de viewport "Mobile" não encontrado');
  }

  // (4) TELA CHEIA — abre o studio split e confirma o modal, depois fecha.
  await card.getByTitle(/tela cheia/i).click();
  await page.waitForSelector('text=Studio — código ao vivo', { timeout: 5000 });
  ok('tela cheia abre o studio split (editor↔preview)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  if (errors.length) fail(`erros de página: ${errors.slice(0, 3).join(' | ')}`);
  else ok('sem erros de página não tratados');
} catch (e) {
  fail(`exceção no smoke: ${e.message}`);
} finally {
  await browser.close();
}

console.log(process.exitCode ? '\nSMOKE FALHOU' : '\nSMOKE OK');
