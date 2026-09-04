// Gera o handoff de uma sessão LENDO O JSONL, sem `--resume`.
//
// Existe porque fechar uma sessão de 780k tokens não pode custar 780k tokens. Em
// 04/09/2026 quatro sessões nesse tamanho receberam prompt com cache frio em 3
// minutos e torraram a janela de 5h inteira (20% → 100%) só em cache_creation.
// Retomar a sessão pra pedir "resuma o que fizemos" pagaria exatamente esse preço.
//
// Aqui o transcript é lido do disco, cortado na cauda e mandado como prompt NOVO
// pro haiku (~5k tokens). O contexto vira arquivo; a sessão é descartável.
//
// Uso:
//   npx tsx scripts/handoff-from-jsonl.mts <sessionId> [<sessionId>…]
//   npx tsx scripts/handoff-from-jsonl.mts --archive <sessionId>   (move o JSONL depois)

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, renameSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CONFIG } from '../server/config';
import { cliPath } from '../server/engine/cli-path';
import { parseSession } from '../server/sessions/parse';
import { sessionPath } from '../server/sessions/records';
import { apiKey } from '../server/summary';
import { scanText } from './scan-secrets';
import type { Message } from '../shared/protocol';

export const HANDOFF_DIR = process.env.COCKPIT_HANDOFF_DIR ?? join(homedir(), '.cockpit', 'handoffs');
const ARCHIVE_DIR = join(homedir(), '.claude', 'session-archive');
const TRANSCRIPT_CAP = 12_000; // ~3k tokens de cauda: o bastante pra reconstruir o estado
const MAX_HANDOFF_CHARS = 5_000;
const MIN_HANDOFF_CHARS = 200;

export const HANDOFF_INSTR =
  'Você recebe a CAUDA do transcript de uma sessão de trabalho que vai ser encerrada. ' +
  'Escreva o handoff dela em markdown, para outra sessão continuar do zero sem ter o histórico. ' +
  'Seções obrigatórias, nesta ordem: Objetivo · Estado atual · Decisões tomadas (com o porquê) · ' +
  'Próximos passos (ordenados) · Arquivos e PRs tocados · Pendências que dependem do Samuel. ' +
  `Máximo ${MAX_HANDOFF_CHARS - 500} caracteres. Português. Não invente o que não está no transcript: ` +
  'se uma seção não tem conteúdo, escreva "—". Responda só o markdown, sem cerca de código externa.';

// Achata as mensagens e mantém a CAUDA. Mesmo formato do server/summary.ts
// (`Você:`/`Claude:`) — o modelo já lida bem com ele e não vale um segundo dialeto.
export function transcriptTail(messages: Message[], cap = TRANSCRIPT_CAP): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      const t = m.text.trim();
      if (t) lines.push(`Você: ${t}`);
    } else if (m.role === 'assistant') {
      const t = m.blocks
        .map((b) => (b.type === 'text' ? b.md : b.type === 'code' ? b.code : ''))
        .join(' ')
        .trim();
      if (t) lines.push(`Claude: ${t}`);
    }
  }
  const joined = lines.join('\n');
  return joined.length > cap ? joined.slice(joined.length - cap) : joined;
}

// Arquivos tocados e PRs citadas saem dos TOOL CALLS, não do texto: o modelo
// resume mal lista longa, e esses dois itens são os que o próximo turno precisa
// exatos. Entram no prompt como fatos já apurados.
export function factsFrom(messages: Message[]): { files: string[]; prs: string[] } {
  const files = new Set<string>();
  const prs = new Set<string>();
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    for (const b of m.blocks) {
      if (b.type !== 'tool') continue;
      const { name, command, label } = b.tool;
      if (/^(Edit|Write|NotebookEdit|MultiEdit)$/.test(name)) {
        const p = (label || command || '').split(/\s+/)[0];
        if (p && p.startsWith('/')) files.add(p);
      }
      for (const m2 of `${command} ${label}`.matchAll(/(?:pull\/|#)(\d{2,6})\b/g)) prs.add(`#${m2[1]}`);
    }
  }
  return { files: [...files].slice(0, 40), prs: [...prs].slice(0, 20) };
}

// Corta no último fim de linha antes do teto. Cortar no caractere exato deixava o
// handoff terminando no meio de uma palavra ("Arquivos e PRs tocados\n- pendenci"),
// e esse texto vira prefixo de prompt da próxima sessão — meia frase confunde mais
// que a seção ausente.
export function capAtLine(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const head = text.slice(0, cap);
  const cut = head.lastIndexOf('\n');
  return (cut > cap * 0.5 ? head.slice(0, cut) : head).trimEnd() + '\n\n_(handoff truncado no teto de tamanho)_';
}

export function buildPrompt(transcript: string, facts: { files: string[]; prs: string[] }): string {
  const f = facts.files.length ? facts.files.join('\n') : '—';
  const p = facts.prs.length ? facts.prs.join(', ') : '—';
  return `${HANDOFF_INSTR}\n\n## Arquivos tocados (apurado das tool calls, use como verdade)\n${f}\n\n## PRs citadas\n${p}\n\n## Cauda do transcript\n${transcript}`;
}

function parseApiResponse(json: unknown): string | null {
  const blocks = (json as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(blocks)) return null;
  const raw = blocks.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('').trim();
  return raw || null;
}

async function viaApi(key: string, prompt: string): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.summaryModel,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) return null;
  return parseApiResponse(await res.json());
}

// Sem API key: `claude -p` em sessão NOVA. Nunca `--resume` — retomar a sessão
// grande é exatamente o custo que este script existe pra evitar.
//
// SEGURANÇA (app-security §4): o prompt é o TRANSCRIPT de uma sessão — texto que
// este script não produziu e que pode carregar README, página web ou comentário de
// PR que o agente leu lá atrás. O env herda `HOME`, então sem gate o filho lê o
// `~/.claude/settings.json` do usuário e nasce em `bypassPermissions`.
//
// `--allowed-tools '' --permission-mode default` (o fix do PR #523) NÃO basta:
// medido em 04/09/2026 nesta box, ele bloqueia escrita (`touch` não criou arquivo)
// mas o filho AINDA LÊ arquivo arbitrário — um canário em /tmp voltou no texto da
// resposta. Como a saída deste script vira prefixo de prompt da próxima sessão,
// leitura é exatamente o vetor que importa (exfiltração via handoff). Só a negação
// EXPLÍCITA por tool fechou os dois.
const DENY_TOOLS = 'Read Bash Glob Grep WebFetch WebSearch Edit Write NotebookEdit Task';

function viaCli(prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    const args = ['-p', prompt, '--model', 'haiku', '--effort', 'low',
      '--allowed-tools', '', '--permission-mode', 'default', '--disallowedTools', DENY_TOOLS,
      '--strict-mcp-config', '--output-format', 'json'];
    const env = { PATH: cliPath(), HOME: process.env.HOME, LANG: process.env.LANG ?? 'en_US.UTF-8', TERM: 'dumb' };
    const child = spawn('claude', args, { cwd: CONFIG.workdir, env, shell: false, stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => resolve(null));
    child.on('close', () => {
      try {
        const r = JSON.parse(out) as { result?: string };
        resolve(typeof r.result === 'string' && r.result.trim() ? r.result.trim() : null);
      } catch { resolve(null); }
    });
  });
}

export async function handoffFor(sessionId: string): Promise<{ path: string; chars: number } | { error: string }> {
  const src = sessionPath(sessionId);
  if (!src || !existsSync(src)) return { error: 'JSONL não encontrado' };
  const parsed = await parseSession(sessionId);
  if (!parsed || parsed.messages.length === 0) return { error: 'transcript vazio' };

  const prompt = buildPrompt(transcriptTail(parsed.messages), factsFrom(parsed.messages));
  const key = apiKey();
  const body = key ? (await viaApi(key, prompt)) ?? (await viaCli(prompt)) : await viaCli(prompt);
  if (!body || body.length < MIN_HANDOFF_CHARS) return { error: 'modelo devolveu handoff vazio/curto' };

  // O handoff vira prefixo de prompt da próxima sessão: um segredo que passou pelo
  // transcript não pode ser promovido a contexto permanente em arquivo.
  const found = scanText(sessionId, body);
  if (found.length) return { error: `segredo no handoff (${found.map((f) => f.rule).join(', ')}) — não gravado` };

  mkdirSync(HANDOFF_DIR, { recursive: true, mode: 0o700 });
  const dest = join(HANDOFF_DIR, `${sessionId}.md`);
  // `parsed.tokens` vem do último usage do caminho ativo e é 0 quando a cauda da
  // sessão não tem um assistant com usage (ex.: acabou num tool_result). Omitir é
  // melhor que anunciar "~0 tokens" numa sessão de 34MB.
  const ctx = parsed.tokens > 0 ? ` Contexto ao encerrar: ~${parsed.tokens.toLocaleString('pt-BR')} tokens.` : '';
  const header = `# Handoff — ${sessionId}\n\n> Gerado de ${src} em ${new Date().toISOString()}.${ctx}\n\n`;
  writeFileSync(dest, header + capAtLine(body, MAX_HANDOFF_CHARS) + '\n', { mode: 0o600 });
  return { path: dest, chars: body.length };
}

export function archive(sessionId: string): string | null {
  const src = sessionPath(sessionId);
  if (!src || !existsSync(src)) return null;
  mkdirSync(ARCHIVE_DIR, { recursive: true });
  const dest = join(ARCHIVE_DIR, `${sessionId}.jsonl`);
  renameSync(src, dest);
  return dest;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const doArchive = argv.includes('--archive');
  const ids = argv.filter((a) => !a.startsWith('--'));
  if (ids.length === 0) {
    console.error('uso: tsx scripts/handoff-from-jsonl.mts [--archive] <sessionId>…');
    return 2;
  }
  let bad = 0;
  for (const id of ids) {
    const r = await handoffFor(id);
    if ('error' in r) { console.error(`✗ ${id}: ${r.error}`); bad++; continue; }
    console.log(`✓ ${id} → ${r.path} (${r.chars} chars, fonte ${(statSync(sessionPath(id)!).size / 1e6).toFixed(1)}MB)`);
    if (doArchive) {
      const moved = archive(id);
      console.log(moved ? `  arquivado em ${moved}` : '  arquivamento falhou');
    }
  }
  return bad ? 1 : 0;
}

// Só executa quando chamado direto (o teste importa as funções puras).
if (process.argv[1]?.endsWith('handoff-from-jsonl.mts')) {
  main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
}
