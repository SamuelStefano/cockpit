import { describe, it, expect } from 'vitest';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { safeSeg, saveAttachment, readAttachment, addUploadChunk, extractDocxText, mimeOf } from './attachments';
import { CONFIG } from './config';

// Monta um .docx mínimo (1 entrada deflate: word/document.xml) sem dependência —
// igual ao que um editor real gera, pra exercitar o parser de ZIP de verdade.
function buildDocx(documentXml: string): Buffer {
  const name = Buffer.from('word/document.xml');
  const content = Buffer.from(documentXml);
  const comp = deflateRawSync(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(name.length, 26);
  const localBlock = Buffer.concat([local, name, comp]);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const centralBlock = Buffer.concat([central, name]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralBlock.length, 12);
  eocd.writeUInt32LE(localBlock.length, 16);
  return Buffer.concat([localBlock, centralBlock, eocd]);
}

describe('mimeOf', () => {
  it('nunca serve svg como image/svg+xml (stored-XSS no bucket S3 público)', () => {
    expect(mimeOf('logo.svg')).toBe('application/octet-stream');
    expect(mimeOf('a.SVG')).toBe('application/octet-stream');
  });

  it('mantém mimes raster e cai em octet-stream no desconhecido', () => {
    expect(mimeOf('x.png')).toBe('image/png');
    expect(mimeOf('x.jpeg')).toBe('image/jpeg');
    expect(mimeOf('x.desconhecido')).toBe('application/octet-stream');
  });
});

describe('safeSeg', () => {
  it('strips directory traversal down to the basename', () => {
    expect(safeSeg('../../etc/passwd', 80, 'file')).toBe('passwd');
    expect(safeSeg('/abs/path/secret.txt', 80, 'file')).toBe('secret.txt');
  });

  it('replaces unsafe characters with underscores', () => {
    expect(safeSeg('a b;rm -rf$(x).png', 80, 'file')).toBe('a_b_rm_-rf__x_.png');
  });

  it('drops leading dots so dotfiles cannot be forged', () => {
    expect(safeSeg('...hidden', 80, 'file')).toBe('hidden');
  });

  it('truncates to the max length', () => {
    expect(safeSeg('x'.repeat(200), 10, 'file')).toBe('x'.repeat(10));
  });

  it('falls back when sanitizing leaves nothing', () => {
    expect(safeSeg('../', 80, 'fallback')).toBe('fallback');
    expect(safeSeg('', 80, 'fallback')).toBe('fallback');
  });
});

describe('saveAttachment', () => {
  it('rejects an empty file before touching disk', async () => {
    expect(await saveAttachment('s', 'x.txt', '')).toEqual({ error: 'arquivo vazio' });
  });

  it('rejects non-string fields before decoding (raw WS frame is untyped)', async () => {
    const bad = { error: 'anexo inválido' };
    expect(await saveAttachment(1 as unknown as string, 'x.txt', 'aGk=')).toEqual(bad);
    expect(await saveAttachment('s', null as unknown as string, 'aGk=')).toEqual(bad);
    expect(await saveAttachment('s', 'x.txt', 42 as unknown as string)).toEqual(bad);
    expect(await saveAttachment('s', 'x.txt', { b: 1 } as unknown as string)).toEqual(bad);
  });

  it('returns extracted text inline for a .docx upload (chip stays on the original)', async () => {
    const docx = buildDocx('<w:document><w:body><w:p><w:r><w:t>texto do documento</w:t></w:r></w:p></w:body></w:document>');
    const saved = await saveAttachment('vitest-docx', 'proposta.docx', docx.toString('base64'));
    try {
      expect('path' in saved && saved.path.endsWith('proposta.docx')).toBe(true);
      expect('text' in saved && saved.text).toBe('texto do documento');
    } finally {
      await rm(resolve(CONFIG.workdir, 'attachments', 'vitest-docx'), { recursive: true, force: true });
    }
  });

  it('falls back to no text when a .docx-named file is not a real docx', async () => {
    const saved = await saveAttachment('vitest-fakedocx', 'fake.docx', Buffer.from('not a zip').toString('base64'));
    try {
      expect('path' in saved).toBe(true);
      expect('text' in saved).toBe(false);
    } finally {
      await rm(resolve(CONFIG.workdir, 'attachments', 'vitest-fakedocx'), { recursive: true, force: true });
    }
  });
});

describe('addUploadChunk', () => {
  // Regressão: `new Array(total)` é esparso e `.some(p => p === undefined)` PULA
  // buracos, então cada chunk finalizava como arquivo próprio — uma imagem virava
  // duas metades no boundary do CHUNK do cliente. Remonta = UM arquivo só.
  it('reassembles multi-chunk upload into a single file (not one per chunk)', async () => {
    const original = Buffer.from('A'.repeat(300) + 'B'.repeat(300) + 'C'.repeat(300));
    const b64 = original.toString('base64');
    const third = Math.ceil(b64.length / 3);
    const chunks = [b64.slice(0, third), b64.slice(third, 2 * third), b64.slice(2 * third)];
    const id = 'up-vitest-reassemble';
    try {
      expect(await addUploadChunk(id, 'vitest-chunk', 'doc.bin', 0, 3, chunks[0])).toBeNull();
      expect(await addUploadChunk(id, 'vitest-chunk', 'doc.bin', 1, 3, chunks[1])).toBeNull();
      const done = await addUploadChunk(id, 'vitest-chunk', 'doc.bin', 2, 3, chunks[2]);
      expect(done && 'path' in done).toBe(true);
      if (!done || !('path' in done)) return;
      const r = await readAttachment(done.path);
      expect('dataB64' in r && Buffer.from(r.dataB64, 'base64').equals(original)).toBe(true);
    } finally {
      await rm(resolve(CONFIG.workdir, 'attachments', 'vitest-chunk'), { recursive: true, force: true });
    }
  });

  it('tolerates out-of-order and duplicate chunks (idempotent per seq)', async () => {
    const original = Buffer.from('x'.repeat(500) + 'y'.repeat(500));
    const b64 = original.toString('base64');
    const half = Math.ceil(b64.length / 2);
    const parts = [b64.slice(0, half), b64.slice(half)];
    const id = 'up-vitest-ooo';
    try {
      expect(await addUploadChunk(id, 'vitest-ooo', 'd.bin', 1, 2, parts[1])).toBeNull();
      expect(await addUploadChunk(id, 'vitest-ooo', 'd.bin', 1, 2, parts[1])).toBeNull(); // duplicata não completa
      const done = await addUploadChunk(id, 'vitest-ooo', 'd.bin', 0, 2, parts[0]);
      expect(done && 'path' in done).toBe(true);
      if (!done || !('path' in done)) return;
      const r = await readAttachment(done.path);
      expect('dataB64' in r && Buffer.from(r.dataB64, 'base64').equals(original)).toBe(true);
    } finally {
      await rm(resolve(CONFIG.workdir, 'attachments', 'vitest-ooo'), { recursive: true, force: true });
    }
  });
});

describe('extractDocxText', () => {
  it('extracts paragraphs, tabs and entities from a real docx zip', () => {
    const xml = '<w:document><w:body>' +
      '<w:p><w:r><w:t>Ol&#225; &amp; bem-vindo</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Col1</w:t><w:tab/><w:t>Col2</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    expect(extractDocxText(buildDocx(xml))).toBe('Olá & bem-vindo\nCol1\tCol2');
  });

  it('separates table cells with a tab even without explicit w:tab', () => {
    const xml = '<w:document><w:body><w:tbl><w:tr>' +
      '<w:tc><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc>' +
      '</w:tr></w:tbl></w:body></w:document>';
    expect(extractDocxText(buildDocx(xml))).toBe('A1\tB1');
  });

  it('drops invalid codepoints instead of throwing (lone surrogate)', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>a&#xD800;b</w:t></w:r></w:p></w:body></w:document>';
    expect(extractDocxText(buildDocx(xml))).toBe('ab');
  });

  it('returns null for a buffer that is not a zip', () => {
    expect(extractDocxText(Buffer.from('not a zip'))).toBeNull();
  });
});

describe('readAttachment', () => {
  it('rejects traversal and paths outside attachments/', async () => {
    const bad = { error: 'anexo inválido' };
    expect(await readAttachment('attachments/../secret')).toEqual(bad);
    expect(await readAttachment('/etc/passwd')).toEqual(bad);
    expect(await readAttachment('other/place/file.png')).toEqual(bad);
    expect(await readAttachment(42 as unknown as string)).toEqual(bad);
  });

  it('reports unavailable when the file is gone (TTL sweep)', async () => {
    expect(await readAttachment('attachments/nope/zzz-aaaa0000-x.png')).toEqual({
      error: 'anexo indisponível (expirado?)',
    });
  });

  it('round-trips a saved attachment and strips the disk prefix from the name', async () => {
    const dataB64 = Buffer.from('conteudo de teste').toString('base64');
    const saved = await saveAttachment('vitest-read', 'foto teste.png', dataB64);
    expect('path' in saved).toBe(true);
    if (!('path' in saved)) return;
    try {
      const r = await readAttachment(saved.path);
      expect(r).toEqual({ name: 'foto_teste.png', dataB64 });
    } finally {
      await rm(resolve(CONFIG.workdir, 'attachments', 'vitest-read'), { recursive: true, force: true });
    }
  });
});
