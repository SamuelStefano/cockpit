import { readdir, stat, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { SessionMeta } from '../../shared/protocol';
import { CONFIG } from '../config';

const UUID_FILE = /^[0-9a-f-]{36}\.jsonl$/;

// Lista sessões sem SQLite (DR-003): readdir + scan reverso de metadado (M2).
// Cache em memória invalidado por mtime.
const cache = new Map<string, { mtime: number; meta: SessionMeta }>();

export async function listSessions(): Promise<SessionMeta[]> {
  let files: string[];
  try {
    files = await readdir(CONFIG.projectsDir);
  } catch {
    return [];
  }

  const metas: SessionMeta[] = [];
  for (const f of files) {
    if (!UUID_FILE.test(f)) continue;
    const id = f.replace('.jsonl', '');
    const full = join(CONFIG.projectsDir, f);
    let st;
    try { st = await stat(full); } catch { continue; }
    const mtime = st.mtimeMs;

    const hit = cache.get(id);
    if (hit && hit.mtime === mtime) { metas.push(hit.meta); continue; }

    const head = await scanMeta(full);
    const meta: SessionMeta = {
      id,
      title: head.title || head.firstUser?.slice(0, 60) || 'Sem título',
      relative: relTime(mtime),
      snippet: head.firstUser?.slice(0, 120) || '',
      mtime,
      count: head.count,
    };
    cache.set(id, { mtime, meta });
    metas.push(meta);
  }

  return metas.sort((a, b) => b.mtime - a.mtime);
}

// Lê o arquivo uma vez: pega o ÚLTIMO ai-title, a 1ª msg de user, e conta msgs.
// (scan linear único — barato o suficiente; evita ler 46MB duas vezes.)
async function scanMeta(path: string): Promise<{ title: string; firstUser?: string; count: number }> {
  const fh = await open(path, 'r');
  let title = '';
  let firstUser: string | undefined;
  let count = 0;
  try {
    const stream = fh.createReadStream({ encoding: 'utf8' });
    let buf = '';
    for await (const chunk of stream) {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let o: any;
        try { o = JSON.parse(line); } catch { continue; }
        if (o.type === 'ai-title' && o.aiTitle) title = o.aiTitle;
        else if (o.type === 'user' || o.type === 'assistant') {
          count++;
          if (!firstUser && o.type === 'user' && o.message) {
            const c = o.message.content;
            firstUser = typeof c === 'string'
              ? c
              : Array.isArray(c) ? c.filter((x: any) => x?.type === 'text').map((x: any) => x.text).join(' ') : '';
          }
        }
      }
    }
  } finally {
    await fh.close();
  }
  return { title, firstUser, count };
}

function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `${d}d atrás`;
}
