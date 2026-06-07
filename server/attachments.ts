import { mkdir, writeFile, readdir, stat, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
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

export async function saveAttachment(
  sessionKey: string,
  name: string,
  dataB64: string,
): Promise<{ path: string } | { error: string }> {
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
  const fname = `${Date.now().toString(36)}-${safeSeg(name, 80, 'file')}`;

  const root = resolve(CONFIG.workdir, 'attachments');
  const dir = resolve(root, key);
  const full = resolve(dir, fname);
  // anti-traversal: tudo tem de cair sob workdir/attachments
  if (!dir.startsWith(root + '/') || !full.startsWith(dir + '/')) return { error: 'nome inválido' };

  await mkdir(dir, { recursive: true });
  await writeFile(full, buf);
  return { path: join('attachments', key, fname) };
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
