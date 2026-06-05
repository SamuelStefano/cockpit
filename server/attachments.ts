import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { CONFIG } from './config';

// Anexo LOCAL: grava o arquivo no workdir isolado do agente e devolve um path
// RELATIVO ao cwd. O agente abre via Read (já na allow-list). Nenhuma credencial,
// nenhum S3 — esse é o primitivo seguro (DR/design 2026-06-05). Sanitiza nome e
// valida contra traversal; teto de bytes evita encher o disco.

const UNSAFE = /[^a-zA-Z0-9._-]/g;

function safeSeg(s: string, max: number, fallback: string): string {
  const out = basename(s).replace(UNSAFE, '_').replace(/^\.+/, '').slice(0, max);
  return out || fallback;
}

export async function saveAttachment(
  sessionKey: string,
  name: string,
  dataB64: string,
): Promise<{ path: string } | { error: string }> {
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
