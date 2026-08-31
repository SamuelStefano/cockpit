// Smoke do bench: compila um componente do repo alvo, joga o bundle no iframe de
// origem opaca (o MESMO documento que o chat usa) e INTERAGE com a tela. Prova o
// elo inteiro — sem isto "compilou" não quer dizer "funciona no chat".
//
//   npm run smoke:bench
//
// Só local: depende do repo `itera-player` clonado e registrado em
// ~/.cockpit/bench.json, então fica fora do CI — ao contrário de `npm run smoke:ui`,
// que se basta com o build estático.
import { chromium } from 'playwright';
import { buildBench } from '../server/bench';
import { IFRAME_HTML_BENCH } from '../src/components/primitives/livepreview/iframeHtmlBench';

const code = `
import { I18nProvider } from '@/i18n';
import { ByocTree } from '@/components/branded/activity/byoc/ByocTree';
import { BYOC_PICK_BEST } from '@/stories/byocFixtures';

export default function Bench() {
  return (
    <I18nProvider>
      <div className="p-6"><ByocTree tree={BYOC_PICK_BEST} onComplete={() => console.log('completou')} /></div>
    </I18nProvider>
  );
}
`;

const r = await buildBench('itera-player', code);
if (!r.ok) { console.error(r.error); process.exit(1); }
console.log(`bundle ${(r.js!.length / 1024) | 0}KB · css ${(r.css!.length / 1024) | 0}KB · ${r.ms}ms`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const problems: string[] = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console.error: ${m.text().slice(0, 300)}`));

await page.setContent('<body style="margin:0"></body>');
// Mesmo protocolo do chat: o documento manda `deck:ready` com uma porta e o
// bundle só viaja por ela — postMessage na janela é ignorado de propósito. O
// listener entra ANTES de o iframe existir, senão o `deck:ready` se perde.
await page.evaluate(([js, css, html]) => {
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'deck:error') console.error('bench:', e.data.message);
    if (e.data?.type === 'deck:ready') e.ports[0]?.postMessage({ js, css });
  });
  const f = document.createElement('iframe');
  f.id = 'f';
  f.setAttribute('sandbox', 'allow-scripts');
  f.style.cssText = 'width:900px;height:700px;border:0';
  f.srcdoc = html;
  document.body.append(f);
}, [r.js!, r.css!, IFRAME_HTML_BENCH]);

const frame = page.frameLocator('#f');
await frame.locator('text=Escolha a melhor opção').waitFor({ timeout: 15_000 });
await page.screenshot({ path: '/tmp/bench-1-inicial.png' });

await frame.locator('[role=button]').filter({ hasText: 'Jogo futebol de quinta' }).click();
await frame.locator('button', { hasText: 'Enviar' }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/bench-2-respondido.png' });

console.log(problems.length ? problems.join('\n') : 'sem erros de console');
await browser.close();
