import { mkdir, writeFile, readFile, readdir, stat, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { CONFIG } from './config';

// Anexo LOCAL: grava o arquivo no workdir isolado do agente e devolve um path
// RELATIVO ao cwd. O agente abre via Read (já na allow-list). Nenhuma credencial,
// nenhum S3 — esse é o primitivo seguro (DR/design 2026-06-05). Sanitiza nome e
// valida contra traversal; teto de bytes evita encher o disco.

const UNSAFE = /[^a-zA-Z0-9._-]/g;

export function safeSeg(s: string, max: number, fallback: string): string {
  const out = basename(s).replace(UNSAFE, '_').replace(/^\.+/, '').slice(0, max);
  return out || fallback;
}

// Teto do texto extraído inflado: limita memória/CPU do inflate (zip bomb) e o
// tamanho do que viaja inline no prompt. RangeError ao exceder cai no catch.
const MAX_INFLATE = 16 * 1024 * 1024;

// Teto do texto inline no prompt: propostas reais são pequenas; trunca docx
// gigante pra não estourar o frame WS nem o contexto do agente.
const MAX_INLINE_TEXT = 200_000;

// Lê uma entrada de um ZIP pelo diretório central (offsets/tamanhos confiáveis).
// Sem dependência: docx é ZIP. Devolve null se não parecer ZIP, faltar a entrada,
// ou usar recursos não suportados (zip64). Bounds-checked: leitura fora do buffer
// vira null em vez de exceção. inflate com teto de saída contra zip bomb.
function unzipEntry(buf: Buffer, wanted: string): Buffer | null {
  if (buf.length < 22) return null;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    if (off + 46 + nameLen > buf.length) return null;
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    if (name === wanted) {
      // 0xffffffff = sentinela zip64 (tamanho/offset reais ficam no extra field,
      // não suportado). Degrada pra null em vez de inflar lixo.
      if (compSize === 0xffffffff || localOff === 0xffffffff) return null;
      if (localOff + 30 > buf.length || buf.readUInt32LE(localOff) !== 0x04034b50) return null;
      const start = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
      if (start + compSize > buf.length) return null;
      const comp = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(comp);
      if (method === 8) return inflateRawSync(comp, { maxOutputLength: MAX_INFLATE });
      return null;
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const XML_ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntity(m: string, e: string): string {
  if (e[0] !== '#') return XML_ENT[e] ?? m;
  const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  // Descarta NUL, surrogates soltos e codepoints fora do range — fromCodePoint
  // lançaria RangeError; preserva só o que é texto legível de verdade.
  if (!Number.isInteger(code) || code <= 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff) return '';
  return String.fromCodePoint(code);
}

// Extrai o texto legível de um .docx: o conteúdo vive em word/document.xml.
// Quebra parágrafos/células/linhas de tabela, tira tags e des-escapa entidades.
// null = não é docx válido ou sem texto (o chamador deixa o original como está).
// Limitação: só word/document.xml — headers/footers/footnotes e a numeração de
// listas ficam de fora; o texto principal e tabelas (com separador de célula) vêm.
export function extractDocxText(buf: Buffer): string | null {
  try {
    const xmlBuf = unzipEntry(buf, 'word/document.xml');
    if (!xmlBuf) return null;
    const text = xmlBuf.toString('utf8')
      .replace(/<\/w:tc>/g, '\t')
      .replace(/<\/w:tr>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab\b[^>]*\/?>/g, '\t')
      .replace(/<w:br\b[^>]*\/?>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, decodeEntity)
      .replace(/\n\t/g, '\t')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]*\n+/g, '\n\n')
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function saveAttachment(
  sessionKey: string,
  name: string,
  dataB64: string,
): Promise<{ path: string; text?: string } | { error: string }> {
  // O frame da WS é JSON.parse cru: os campos chegam sem validação de tipo. Um
  // dataB64 não-string faria Buffer.from lançar; sessionKey/name não-string
  // quebraria o basename. Recusa cedo em vez de cair no caminho de erro.
  if (typeof sessionKey !== 'string' || typeof name !== 'string' || typeof dataB64 !== 'string') {
    return { error: 'anexo inválido' };
  }
  const buf = Buffer.from(dataB64, 'base64');
  if (buf.length === 0) return { error: 'arquivo vazio' };
  if (buf.length > CONFIG.maxUploadBytes) return { error: 'arquivo grande demais' };

  const key = safeSeg(sessionKey, 64, 'default');
  // Sufixo aleatório além do timestamp: dois uploads no mesmo ms com o mesmo nome
  // resolveriam pro mesmo path e o 2º sobrescreveria o 1º (Read apontaria errado).
  const fname = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}-${safeSeg(name, 80, 'file')}`;

  const root = resolve(CONFIG.workdir, 'attachments');
  const dir = resolve(root, key);
  const full = resolve(dir, fname);
  // anti-traversal: tudo tem de cair sob workdir/attachments
  if (!dir.startsWith(root + '/') || !full.startsWith(dir + '/')) return { error: 'nome inválido' };

  await mkdir(dir, { recursive: true });
  await writeFile(full, buf);
  const rel = join('attachments', key, fname);

  // .docx é um ZIP binário — nem o Read do agente nem o preview o parseiam. Extrai
  // o texto e devolve inline (o cliente embute no prompt): o agente recebe o
  // conteúdo direto, sem depender do Read, e o chip segue apontando pro .docx
  // original (preview/download intactos). xlsx/pptx/outros binários seguem crus;
  // PDF o Read nativo já parseia.
  if (/\.docx$/i.test(name)) {
    const text = extractDocxText(buf);
    if (text) return { path: rel, text: text.length > MAX_INLINE_TEXT ? text.slice(0, MAX_INLINE_TEXT) + '\n\n[…texto truncado]' : text };
    console.warn(`[attachments] extração de texto falhou para .docx: ${name}`);
  }
  return { path: rel };
}

// Lê um anexo salvo pra preview no chat. Aceita só paths relativos no formato que
// saveAttachment devolve ('attachments/<key>/<fname>') e revalida contra traversal
// — o path chega cru do cliente via WS. error quando o sweep TTL já levou o arquivo.
export async function readAttachment(
  relPath: string,
): Promise<{ name: string; dataB64: string } | { error: string }> {
  if (typeof relPath !== 'string' || !relPath.startsWith('attachments/')) {
    return { error: 'anexo inválido' };
  }
  const root = resolve(CONFIG.workdir, 'attachments');
  const full = resolve(CONFIG.workdir, relPath);
  if (!full.startsWith(root + '/')) return { error: 'anexo inválido' };
  try {
    const st = await stat(full);
    if (!st.isFile() || st.size > CONFIG.maxUploadBytes) return { error: 'anexo indisponível' };
    const buf = await readFile(full);
    // Mesmo prefixo que saveAttachment gera (ts36-hex-nome) — devolve o nome original.
    const name = basename(full).replace(/^[a-z0-9]+-[a-z0-9]+-/i, '') || basename(full);
    return { name, dataB64: buf.toString('base64') };
  } catch {
    return { error: 'anexo indisponível (expirado?)' };
  }
}

// Varre workdir/attachments e remove arquivos mais velhos que o TTL (anexos são
// one-shot). Best-effort: qualquer erro de FS é ignorado. Diretórios de sessão
// que ficam vazios são removidos. Só toca sob workdir/attachments.
export async function sweepAttachments(): Promise<number> {
  const root = resolve(CONFIG.workdir, 'attachments');
  const cutoff = Date.now() - CONFIG.attachmentTtlMs;
  let removed = 0;
  let sessionDirs: string[];
  try {
    sessionDirs = await readdir(root);
  } catch {
    return 0; // sem dir de anexos ainda
  }
  for (const seg of sessionDirs) {
    const dir = resolve(root, seg);
    if (!dir.startsWith(root + '/')) continue;
    let files: string[];
    try { files = await readdir(dir); } catch { continue; }
    let live = 0;
    for (const f of files) {
      const full = resolve(dir, f);
      if (!full.startsWith(dir + '/')) continue;
      try {
        const st = await stat(full);
        if (st.isFile() && st.mtimeMs < cutoff) { await rm(full, { force: true }); removed++; }
        else live++;
      } catch { /* corrida com outra remoção — ignora */ }
    }
    if (live === 0) { try { await rm(dir, { recursive: true, force: true }); } catch { /* best-effort */ } }
  }
  return removed;
}
