import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, resolve } from 'node:path';
import type { SessionMeta } from '../../shared/protocol';
import { CONFIG } from '../config';
import { metaForId } from './index';

// Busca por conteúdo SEM índice (DR-005): `grep -F` on-demand sobre os JSONL.
// 47 arquivos / 236MB varrem em ~50ms — interativo. argv-array + shell:false +
// `--` antes do termo = sem injeção. Resultado = SessionMeta[] com o snippet
// trocado pela linha de prosa que casou (a lista do sidebar renderiza igual).

const execFileP = promisify(execFile);
const UUID_FILE = /^([0-9a-f-]{36})\.jsonl$/;
const MAX_HITS = 40;

export async function searchSessions(q: string): Promise<SessionMeta[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const dir = resolve(CONFIG.projectsDir);

  let stdout = '';
  try {
    const r = await execFileP(
      'grep',
      ['-rliaF', '--include=*.jsonl', '--', query, dir],
      { maxBuffer: 1 << 20 },
    );
    stdout = r.stdout;
  } catch (e: any) {
    if (e?.code === 1) return []; // grep exit 1 = nenhum match
    throw e;
  }

  const files = stdout.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, MAX_HITS);
  const out: SessionMeta[] = [];
  for (const f of files) {
    const rp = resolve(f);
    if (!rp.startsWith(dir + '/')) continue; // anti-traversal (squad H1)
    const m = UUID_FILE.exec(basename(rp));
    if (!m) continue;
    const meta = await metaForId(m[1]);
    if (!meta) continue;
    const snip = await matchSnippet(rp, query);
    out.push(snip ? { ...meta, snippet: snip } : meta);
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Primeira linha de prosa (user/assistant) que contém o termo. Para no 1º hit —
// barato mesmo no arquivo de 46MB. Pula ruído (tool_result, base64): se o match
// só existir fora de prosa, devolve null e o caller mantém o snippet padrão.
async function matchSnippet(path: string, q: string): Promise<string | null> {
  const needle = q.toLowerCase();
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line.toLowerCase().includes(needle)) continue;
      let o: any;
      try { o = JSON.parse(line); } catch { continue; }
      if (o?.type !== 'user' && o?.type !== 'assistant') continue;
      const text = extractText(o.message?.content);
      const i = text.toLowerCase().indexOf(needle);
      if (i < 0) continue;
      const start = Math.max(0, i - 40);
      const body = text.slice(start, i + q.length + 80).replace(/\s+/g, ' ').trim();
      return (start > 0 ? '…' : '') + body + '…';
    }
  } finally {
    rl.close();
  }
  return null;
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join(' ');
  }
  return '';
}
