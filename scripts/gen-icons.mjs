// Gera os PNGs do manifest/apple-touch/favicon a partir do Bit (mascote do Deck,
// src/components/bit/Bit.tsx em estado idle, estático), rasterizando SVG no chromium
// que o repo já usa nos smokes — evita dependência nativa nova só pra isso.
// Os PNGs são versionados; rodar `node scripts/gen-icons.mjs` só quando a marca
// mudar. Saída determinística: mesmo SVG + mesmo chromium = mesmo byte.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC = join(ROOT, 'public');
// The App Store icon: 1024 px, no alpha, rendered from the same mark (never upscaled from 512).
const IOS_ASSETS = join(ROOT, 'apps', 'ios', 'assets');

const BG = '#101013';
const ORANGE_FROM = '#f97316';
const ORANGE_TO = '#c2410c';
const GLYPH = '#0a0a0a';

// Bit idle, static copy of Bit.tsx + BitFace.tsx (no CSS animation). `fill` = mascot height over canvas height.
function bitSvg(fill, { detail = true } = {}) {
  const s = (100 * fill) / 111;
  const tx = 50 - 60 * s;
  const ty = 50 - 57.5 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <clipPath id="bit-scr"><rect x="32" y="40" width="56" height="50" rx="13"/></clipPath>
    <linearGradient id="bit-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fb923c"/>
      <stop offset="1" stop-color="#f97316"/>
    </linearGradient>
    <radialGradient id="bit-glow">
      <stop offset="0" stop-color="#f97316" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#f97316" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" fill="${BG}"/>
  <g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(4)})">
    <ellipse cx="60" cy="113" rx="30" ry="4" fill="#000" opacity="0.45"/>
    <path d="M60 30V17" stroke="#c2410c" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="60" cy="12" r="10" fill="url(#bit-glow)"/>
    <circle cx="60" cy="12" r="4.6" fill="#fdba74"/>
    <path d="M24 70q-12 4-12 16" stroke="#c2410c" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M96 70q12 4 12 16" stroke="#c2410c" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M44 101v8M76 101v8" stroke="#c2410c" stroke-width="7" stroke-linecap="round"/>
    <rect x="20" y="28" width="80" height="76" rx="22" fill="url(#bit-body)"/>
    <rect x="20" y="28" width="80" height="76" rx="22" fill="none" stroke="#c2410c" stroke-width="2.4" opacity="0.55"/>
    <path d="M31 36q29-8 58 0" stroke="#fff" stroke-opacity="0.3" stroke-width="3" stroke-linecap="round" fill="none"/>
    <rect x="32" y="40" width="56" height="50" rx="13" fill="#140b05"/>
    <rect x="32" y="40" width="56" height="50" rx="13" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="2"/>
    ${detail ? '<text x="37" y="50" fill="#f97316" opacity="0.5" font-size="7.5" font-weight="700" font-family="ui-monospace, monospace">&gt;_</text>' : ''}
    <rect x="43" y="52" width="10" height="14" rx="5" fill="#fed7aa"/>
    <rect x="67" y="52" width="10" height="14" rx="5" fill="#fed7aa"/>
    <circle cx="50" cy="56" r="2" fill="#fff"/>
    <circle cx="74" cy="56" r="2" fill="#fff"/>
    <rect x="55" y="75" width="10" height="3.4" rx="1.4" fill="#fed7aa"/>
    <circle cx="30" cy="96" r="2.4" fill="#fff" opacity="0.35"/>
  </g>
</svg>`;
}

// Old terminal mark, kept only for the iOS App Store icon (already approved).
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
  { file: 'icon-192.png', size: 192, svg: () => bitSvg(0.8) },
  { file: 'icon-512.png', size: 512, svg: () => bitSvg(0.8) },
  { file: 'icon-512-maskable.png', size: 512, svg: () => bitSvg(0.56) },
  { file: 'apple-touch-icon.png', size: 180, svg: () => bitSvg(0.8) },
  { file: 'favicon-32.png', size: 32, svg: () => bitSvg(0.94, { detail: false }) },
  { file: 'icon.png', dir: IOS_ASSETS, size: 1024, svg: () => markSvg(0.62), skip: !process.env.GEN_IOS },
];

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(join(PUBLIC, 'favicon.svg'), bitSvg(0.94, { detail: false }) + '\n');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { file, dir = PUBLIC, size, svg, skip } of TARGETS) {
  if (skip) continue;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:${BG}}svg{display:block;width:${size}px;height:${size}px}</style>${svg()}`,
  );
  await page.screenshot({ path: join(dir, file), omitBackground: false });
  console.log(`${file} ${size}x${size}`);
}
await browser.close();
