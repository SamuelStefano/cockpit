import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Message } from '../shared/protocol';
import { CONFIG } from './config';
import { parseSession } from './sessions/parse';
import { setSummary } from './db';
import { broadcast } from './ws/broadcast';

// Resumo IA do que a sessão fez, abaixo do título no sidebar (pedido do Samuel:
// "no final da task ele atualiza indicando um resumo do que foi aquela sessão").
// Gerado pela API Anthropic direto (haiku, barato), NÃO pelo `claude -p`: spawnar
// o CLI criaria um JSONL de sessão lixo no projectsDir e poluiria a própria lista.
// Best-effort: qualquer falha (sem key, rede, lock) só não gera resumo — nunca
// derruba o turno.

const CRED_PATH = join(homedir(), '.config', 'anthropic', 'credentials');
const TRANSCRIPT_CAP = 6000; // ~1.5k tokens de input: cauda da conversa basta p/ resumir
const PROMPT_INSTR =
  'Resuma em UMA frase curta (máximo 12 palavras, em português) o que esta sessão fez ou está fazendo. ' +
  'Responda só o resumo, sem aspas, sem prefixo, sem ponto final.';

let cachedKey: string | null | undefined; // undefined = não lido ainda; null = ausente
const inFlight = new Set<string>();
// Throttle por sessão: o resumo dispara no `done` de TODO turno. Em rajada (vários
// turnos curtos) isso era uma chamada API paga por turno. Só re-resume se passou o
// intervalo mínimo desde o último — a cauda da conversa não muda o bastante em
// segundos pra justificar regerar. COCKPIT_SUMMARY=off continua como kill-switch.
const lastAt = new Map<string, number>();
const MIN_INTERVAL_MS = 90_000;

function apiKey(): string | null {
  if (cachedKey !== undefined) return cachedKey;
  try {
    const txt = readFileSync(CRED_PATH, 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith('ANTHROPIC_API_KEY='));
    cachedKey = line ? line.slice('ANTHROPIC_API_KEY='.length).trim() : null;
  } catch {
    cachedKey = null;
  }
  return cachedKey;
}

// Achata as mensagens num texto "Você:/Claude:" e mantém só a CAUDA (a parte mais
// recente é a mais representativa do estado atual da sessão). Pura.
export function transcriptText(messages: Message[], cap = TRANSCRIPT_CAP): string {
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

export function summaryUserPrompt(transcript: string): string {
  return `${PROMPT_INSTR}\n\n---\n${transcript}`;
}

// Normaliza a resposta da API: 1ª frase, sem aspas/ponto final, cap de tamanho.
// Pura — separada do fetch p/ ser testável sem rede.
export function parseSummaryResponse(json: unknown): string | null {
  const blocks = (json as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(blocks)) return null;
  const raw = blocks.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join(' ').trim();
  if (!raw) return null;
  const clean = raw.replace(/^["'`]+|["'`.]+$/g, '').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, 140) : null;
}

async function callAnthropic(key: string, transcript: string): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.summaryModel,
      max_tokens: 60,
      messages: [{ role: 'user', content: summaryUserPrompt(transcript) }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  return parseSummaryResponse(await res.json());
}

// Gera (ou atualiza) o resumo de uma sessão e faz broadcast pro sidebar atualizar
// ao vivo. Fire-and-forget: chamado no `done` do turno. Guard de in-flight evita
// duas gerações simultâneas pra mesma sessão.
export async function summarize(sessionId: string): Promise<void> {
  if (!CONFIG.summaryEnabled || !sessionId || inFlight.has(sessionId)) return;
  const now = Date.now();
  // Poda entradas velhas: passado o intervalo, não há mais throttle a aplicar —
  // senão o Map cresce 1 entrada por sessão pra sempre. Barato (poucas sessões).
  if (lastAt.size > 64) for (const [k, ts] of lastAt) if (now - ts > MIN_INTERVAL_MS) lastAt.delete(k);
  if (now - (lastAt.get(sessionId) ?? 0) < MIN_INTERVAL_MS) return;
  const key = apiKey();
  if (!key) return;
  inFlight.add(sessionId);
  lastAt.set(sessionId, Date.now());
  try {
    const parsed = await parseSession(sessionId);
    if (!parsed || parsed.messages.length === 0) return;
    const transcript = transcriptText(parsed.messages);
    if (!transcript) return;
    const summary = await callAnthropic(key, transcript);
    if (!summary) return;
    setSummary(sessionId, summary);
    broadcast({ t: 'session-summary', sessionId, summary });
  } catch {
    // rede/parse/lock — resumo é opcional, não propaga
  } finally {
    inFlight.delete(sessionId);
  }
}
