import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// Paleta Vila 48 (8 ramps x 6 tones), copied from lina/vila/ui-kit/paleta-48.json
const VILA_48 = [
  '#1F280F', '#35511A', '#477A2D', '#62A353', '#75CC71', '#92F49C',
  '#28230F', '#514D1A', '#747A2D', '#91A353', '#AACC71', '#C2F492',
  '#280F0F', '#51221A', '#7A432D', '#A37653', '#CCA671', '#F4DA92',
  '#280F17', '#511A24', '#7A2D30', '#A35C53', '#F97316', '#F4BA92',
  '#4C2226', '#6F3B38', '#915F53', '#B48871', '#D7B494', '#F5E6C8',
  '#0F2825', '#1A5051', '#2D6E7A', '#538AA3', '#71A2CC', '#92BAF4',
  '#0F1028', '#1F1A51', '#3F2D7A', '#7253A3', '#A271CC', '#D592F4',
  '#1E1A2B', '#424A50', '#656D78', '#898FA0', '#AFB3C7', '#D8D7EF',
];
const OVERLAY = '#1E1A2B';
const BOTS_DIR = join(process.cwd(), 'public/world/v2/bots');
const SHEET_W = 256;
const SHEET_H = 1728;

const hex = (r: number, g: number, b: number) => `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()}`;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

interface Rgba { width: number; height: number; data: Uint8Array }

function decodePng(buf: Buffer): Rgba {
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    pos += len + 12;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels || interlace !== 0 || (depth !== 8 && colorType !== 3)) throw new Error(`unsupported png: type ${colorType} depth ${depth} interlace ${interlace}`);
  const bpp = Math.max(1, (channels * depth) / 8);
  const stride = Math.ceil((width * channels * depth) / 8);
  const raw = inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0;
      const b = y > 0 ? px[dst + x - stride] : 0;
      const c = x >= bpp && y > 0 ? px[dst + x - stride - bpp] : 0;
      const pred = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c);
      px[dst + x] = (raw[src + x] + pred) & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const i = y * stride + x * channels;
      if (colorType === 3) {
        const bit = x * depth;
        const idx = depth === 8 ? px[y * stride + x] : (px[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
        if (!palette) throw new Error('indexed png without PLTE');
        data.set([palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2], trns && idx < trns.length ? trns[idx] : 255], o);
      } else if (colorType === 6) data.set(px.subarray(i, i + 4), o);
      else if (colorType === 2) data.set([px[i], px[i + 1], px[i + 2], 255], o);
      else data.set([px[i], px[i], px[i], colorType === 4 ? px[i + 1] : 255], o);
    }
  }
  return { width, height, data };
}

function audit(file: string) {
  const { width, height, data } = decodePng(readFileSync(join(BOTS_DIR, file)));
  const opaque = new Set<string>();
  const translucent = new Set<string>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    (a === 255 ? opaque : translucent).add(hex(data[i], data[i + 1], data[i + 2]));
  }
  return { width, height, opaque, translucent };
}

const sheets = readdirSync(BOTS_DIR).filter((f) => f.endsWith('.png') && !f.endsWith('-shirt.png')).sort();

describe('bot sheets use only Paleta Vila 48', () => {
  it('finds the 22 sheets', () => {
    expect(sheets).toHaveLength(22);
    expect(new Set(VILA_48).size).toBe(48);
    expect(VILA_48).toContain(OVERLAY);
  });

  it.each(sheets)('%s', (file) => {
    const { width, height, opaque, translucent } = audit(file);
    expect([width, height]).toEqual([SHEET_W, SHEET_H]);
    expect(opaque.size).toBeGreaterThan(4);
    expect([...opaque].filter((c) => !VILA_48.includes(c)).sort()).toEqual([]);
    expect([...translucent]).toEqual([OVERLAY]);
  });
});
