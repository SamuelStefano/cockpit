import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { Message } from '../shared/protocol';
import { CONFIG } from './config';
import { parseSession } from './sessions/parse';
import { apiKey, transcriptText } from './summary';
import { hideSession } from './store';

// Segundo write path do memoryDir (o 1º é installContext), então repete os mesmos
// guards: slug allow-listado, prefixo próprio e anti-traversal.

const SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const TRANSCRIPT_CAP = 24_000; // ~6k tokens de input
const MAX_BODY_CHARS = 32_000;
const inFlight = new Set<string>();

const INSTR = [
  'Você está migrando uma sessão de trabalho lotada para um chat novo.',
  'Escreva, em português, um briefing que permita retomar o trabalho SEM ter a conversa antiga.',
  'Use exatamente estas seções markdown, nesta ordem:',
  '## Contexto — o que é o trabalho, em que repositório/arquivos, e as decisões já tomadas.',
  '## Tarefas principais — lista com o que está feito e o que falta, marcando [x] e [ ].',
  '## Próximo passo — uma frase com a ação imediata.',
  'Seja específico: cite caminhos de arquivo, branches, PRs e comandos reais que apareceram.',
  'Não invente nada que não esteja na conversa. Responda só o markdown, sem preâmbulo.',
].join(' ');

// Dia em BRT: a VPS roda em UTC, e um handoff feito às 22h de Maringá cairia no
// dia seguinte se o slug saísse do ISO cru.
function brtDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(at).replace(/-/g, '');
}

export function handoffSlug(sessionId: string, at = new Date()): string {
  const short = String(sessionId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'sessao';
  return `handoff-${brtDay(at)}-${short}`;
}

// O briefing precisa das decisões do COMEÇO e do estado do FIM. Cortar só a cauda
// (o que basta pro resumo de uma linha) descartaria justamente o que a migração
// existe pra preservar.
export function headTail(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const head = Math.floor(cap * 0.4);
  return `${text.slice(0, head)}\n\n[...trecho do meio omitido...]\n\n${text.slice(text.length - (cap - head))}`;
}

export function handoffPrompt(transcript: string): string {
  return `${INSTR}\n\n---\n${transcript}`;
}

export function parseHandoffResponse(json: unknown): string | null {
  const blocks = (json as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(blocks)) return null;
  const raw = blocks.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('\n').trim();
  return raw || null;
}

// Primeira fala do usuário vira a descrição do contexto — é o que identifica a
// sessão na lista de Contextos sem precisar abrir o arquivo.
export function handoffDescription(messages: Message[]): string {
  const first = messages.find((m) => m.role === 'user' && m.text.trim());
  const text = first && first.role === 'user' ? first.text.trim() : '';
  return text.replace(/\s+/g, ' ').slice(0, 100) || 'sessão migrada';
}

export function handoffFile(slug: string, description: string, body: string, at = new Date()): string {
  const safe = description.replace(/[\r\n]/g, ' ').slice(0, 120);
  const when = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(at);
  return `---\nname: ${slug}\ndescription: ${safe}\nmetadata:\n  type: reference\n---\n\n> Migrado de uma sessão lotada em ${when} (BRT).\n\n${body}\n`;
}

async function callAnthropic(key: string, transcript: string): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.summaryModel,
      max_tokens: 2000,
      messages: [{ role: 'user', content: handoffPrompt(transcript) }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return null;
  return parseHandoffResponse(await res.json());
}

// Só arquiva DEPOIS de gravar o contexto: se a destilação falhar, o usuário fica
// com a sessão intacta em vez de perder o fio.
export async function handoffSession(sessionId: string): Promise<{ contextId: string } | { error: string }> {
  const key = apiKey();
  if (!key) return { error: 'sem chave da API para destilar o contexto' };
  // Cada handoff é uma chamada paga de ~6k tokens de input: sem este guard um
  // cliente qualquer disparava N destilações da mesma sessão em paralelo.
  if (inFlight.has(sessionId)) return { error: 'migração já em andamento' };
  inFlight.add(sessionId);
  try {
    const parsed = await parseSession(sessionId);
    if (!parsed || parsed.messages.length === 0) return { error: 'sessão sem conversa para migrar' };
    const transcript = headTail(transcriptText(parsed.messages, Infinity), TRANSCRIPT_CAP);
    if (!transcript) return { error: 'sessão sem conversa para migrar' };

    let body: string | null;
    try { body = await callAnthropic(key, transcript); }
    catch { return { error: 'falha ao contatar a API' }; }
    if (!body) return { error: 'não consegui destilar o contexto' };
    body = body.slice(0, MAX_BODY_CHARS);

    const id = handoffSlug(sessionId);
    if (!SLUG_RE.test(id)) return { error: 'slug inválido' };
    const dir = resolve(CONFIG.memoryDir);
    const full = resolve(join(dir, `${id}.md`));
    if (!full.startsWith(dir + '/') || basename(full) !== `${id}.md`) return { error: 'caminho inválido' };

    try {
      await mkdir(dir, { recursive: true });
      await writeFile(full, handoffFile(id, handoffDescription(parsed.messages), body), 'utf8');
    } catch { return { error: 'falha ao gravar o contexto' }; }

    await hideSession(sessionId);
    return { contextId: id };
  } finally {
    inFlight.delete(sessionId);
  }
}
