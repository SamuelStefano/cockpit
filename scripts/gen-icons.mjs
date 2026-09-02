// Gera os PNGs do manifest/apple-touch a partir da marca do Deck (quadrado
// laranja + glifo `terminal` do Header/BrandMark), rasterizando SVG no chromium
// que o repo já usa nos smokes — evita dependência nativa nova só pra isso.
// Os PNGs são versionados; rodar `node scripts/gen-icons.mjs` só quando a marca
// mudar. Saída determinística: mesmo SVG + mesmo chromium = mesmo byte.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PUBLIC = join(dirname(dirname(fileURLToPath(import.meta.url))), 'public');

const BG = '#101013';
const ORANGE_FROM = '#f97316';
const ORANGE_TO = '#c2410c';
const GLYPH = '#0a0a0a';

// `ratio` = lado do quadrado laranja sobre o lado do canvas. O ícone maskable usa
// um valor menor porque o SO recorta um círculo de 80%: a 0.62 os cantos do
// quadrado caem fora da zona segura e o Android come a quina.
function markSvg(ratio) {
  const side = 100 * ratio;
  const off = (100 - side) / 2;
  const radius = side * 0.22;
  const glyph = side * 0.58;
  const glyphOff = (100 - glyph) / 2;
  const scale = glyph / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ORANGE_FROM}"/>
      <stop offset="1" stop-color="${ORANGE_TO}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="${BG}"/>
  <rect x="${off}" y="${off}" width="${side}" height="${side}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${glyphOff} ${glyphOff}) scale(${scale})" fill="none" stroke="${GLYPH}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </g>
</svg>`;
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, ratio: 0.62 },
  { file: 'icon-512.png', size: 512, ratio: 0.62 },
  { file: 'icon-512-maskable.png', size: 512, ratio: 0.52 },
  { file: 'apple-touch-icon.png', size: 180, ratio: 0.62 },
  { file: 'favicon-32.png', size: 32, ratio: 0.72 },
];

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(join(PUBLIC, 'favicon.svg'), markSvg(0.72) + '\n');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { file, size, ratio } of TARGETS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:${BG}}svg{display:block;width:${size}px;height:${size}px}</style>${markSvg(ratio)}`,
  );
  await page.screenshot({ path: join(PUBLIC, file), omitBackground: false });
  console.log(`${file} ${size}x${size}`);
}
await browser.close();
