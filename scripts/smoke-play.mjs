// Smoke da rota /play (playground standalone): cada linguagem precisa renderizar
// no runtime certo do iframe — React, juiz de testes (verde/vermelho), SVG cru e
// app nativo. Roda contra `vite preview` (build estático), sem backend.
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1; };

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const frameText = async () => {
  await page.waitForSelector('iframe[title="live preview"]', { timeout: 10000 });
  await page.waitForTimeout(900);
  return page.frameLocator('iframe[title="live preview"]').first().locator('body').innerText().catch(() => '');
};

try {
  await page.goto(`${BASE}/play`, { waitUntil: 'networkidle', timeout: 20000 });
  ok('/play carrega');

  // React (template default) — o contador mostra "clique pra contar".
  const reactText = await frameText();
  if (reactText.includes('clique pra contar')) ok('React: template renderiza no preview');
  else fail(`React não renderizou — "${reactText.slice(0, 60)}"`);

  // Juiz de testes — roda expect() e mostra resumo "N/N passaram" + ✓.
  await page.getByRole('button', { name: 'Testes' }).click();
  const testText = await frameText();
  if (testText.includes('passaram') && testText.includes('✓')) ok(`juiz de testes rodou asserções ("${testText.split('\n').pop()}")`);
  else fail(`juiz de testes não produziu resultado — "${testText.slice(0, 80)}"`);
  // Badge de resumo na barra do studio (passed/total).
  const badge = await page.locator('text=/\\d+\\/\\d+ ✓/').count();
  if (badge > 0) ok('badge de aprovados aparece na barra');
  else fail('badge N/N ✓ não apareceu');

  // SVG — o markup cru vira um <svg> de verdade dentro do iframe.
  await page.getByRole('button', { name: 'SVG' }).click();
  await page.waitForSelector('iframe[title="live preview"]', { timeout: 10000 });
  await page.waitForTimeout(900);
  const svgCount = await page.frameLocator('iframe[title="live preview"]').first().locator('svg').count();
  if (svgCount > 0) ok('SVG: markup renderiza como elemento <svg>');
  else fail('SVG não renderizou nenhum <svg>');

  // iPhone (react-native-web) — o app nativo mostra "App nativo".
  await page.getByRole('button', { name: 'iPhone' }).click();
  const nativeText = await frameText();
  if (nativeText.includes('App nativo')) ok('iPhone: app react-native renderiza');
  else fail(`nativo não renderizou — "${nativeText.slice(0, 60)}"`);

  // Editar no modo nativo re-renderiza (prova que /play também é editável ao vivo).
  const ta = page.locator('textarea').first();
  await ta.focus();
  await ta.fill(`import { View, Text } from 'react-native';\nexport default function App(){return <View><Text>PLAY_EDIT_OK</Text></View>;}`);
  await page.waitForTimeout(900);
  const edited = await page.frameLocator('iframe[title="live preview"]').first().locator('body').innerText().catch(() => '');
  if (edited.includes('PLAY_EDIT_OK')) ok('editar no /play re-renderiza a tela ao vivo');
  else fail(`edição no /play não refletiu — "${edited.slice(0, 60)}"`);

  if (errors.length) fail(`erros de página: ${errors.slice(0, 3).join(' | ')}`);
  else ok('sem erros de página não tratados');
} catch (e) {
  fail(`exceção no smoke: ${e.message}`);
} finally {
  await browser.close();
}

console.log(process.exitCode ? '\nSMOKE FALHOU' : '\nSMOKE OK');
