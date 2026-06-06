import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import type { Block, Message, ToolCall, ToolDiff } from '../../shared/protocol';
import { CONFIG } from '../config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Usage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface Rec {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  message?: { role: string; content: unknown; usage?: Usage };
  leafUuid?: string;
}

// Tokens de contexto "em voo" no último turno = entrada + cache (o que foi
// enviado ao modelo). Aproxima o quanto da janela de contexto está ocupado.
export function ctxTokens(u?: Usage): number {
  if (!u) return 0;
  return (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
}

// Resolve o caminho do JSONL com validação anti-traversal (squad High-1).
export function sessionPath(sessionId: string): string | null {
  if (!UUID_RE.test(sessionId)) return null;
  const p = resolve(join(CONFIG.projectsDir, `${sessionId}.jsonl`));
  if (!p.startsWith(resolve(CONFIG.projectsDir))) return null;
  return p;
}

// Lê o JSONL e reconstrói o CAMINHO ATIVO (não-linear; squad C1):
// 1. último last-prompt.leafUuid = leaf ativo
// 2. indexa uuid -> record (só user/assistant)
// 3. caminha parentUuid leaf->raiz, inverte
export async function parseSession(
  sessionId: string,
  limit = CONFIG.historyLimit
): Promise<{ blocks: Block[]; messages: Message[]; tokens: number } | null> {
  const path = sessionPath(sessionId);
  if (!path) return null;

  const byUuid = new Map<string, Rec>();
  let leaf: string | undefined;

  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    let r: Rec;
    try { r = JSON.parse(s) as Rec; } catch { continue; }
    if (r.type === 'last-prompt' && r.leafUuid) leaf = r.leafUuid;
    // indexa TODO record com uuid: o parentUuid de user/assistant pode apontar
    // pra um nó intermediário (attachment/system) — se só indexar user/assistant
    // a caminhada quebra no 1º intermediário e trunca o histórico (squad).
    if (r.uuid) byUuid.set(r.uuid, r);
  }

  // fallback: sem leaf, usa o último record inserido
  if (!leaf) {
    const keys = [...byUuid.keys()];
    leaf = keys[keys.length - 1];
  }

  const chain: Rec[] = [];
  let cur: string | undefined = leaf;
  const guard = new Set<string>();
  while (cur && byUuid.has(cur) && !guard.has(cur)) {
    guard.add(cur);
    const r: Rec = byUuid.get(cur)!;
    if (r.type === 'user' || r.type === 'assistant') chain.push(r);
    cur = r.parentUuid ?? undefined;
  }
  chain.reverse();

  // Último assistant da cadeia ativa carrega o usage mais recente = contexto atual.
  let tokens = 0;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].type === 'assistant' && chain[i].message?.usage) { tokens = ctxTokens(chain[i].message!.usage); break; }
  }

  const trimmed = chain.slice(-limit);
  const messages = trimmed.map(recToMessage).filter((m): m is Message => m !== null);
  const blocks = messages.flatMap((m) => (m.role === 'assistant' ? m.blocks : [{ type: 'text' as const, md: m.text }]));
  return { blocks, messages, tokens };
}

function recToMessage(r: Rec): Message | null {
  if (!r.message) return null;
  const content = r.message.content;
  if (r.message.role === 'user') {
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('\n')
        : '';
    if (!text.trim()) return null;
    return { id: r.uuid!, role: 'user', text };
  }
  if (r.message.role === 'assistant' && Array.isArray(content)) {
    const blocks: Block[] = [];
    for (const c of content as any[]) {
      if (c?.type === 'text' && c.text) blocks.push({ type: 'text', md: c.text });
      else if (c?.type === 'thinking' && c.thinking) blocks.push({ type: 'thinking', text: c.thinking });
      else if (c?.type === 'tool_use') {
        const tool: ToolCall = {
          id: c.id ?? '',
          name: c.name ?? 'tool',
          label: c.name ?? 'tool',
          command: extractCommand(c.input),
          status: 'done',
          diff: diffOf(c.name, c.input),
          markdown: planOf(c.name, c.input),
          output: [],
        };
        blocks.push({ type: 'tool', tool });
      }
    }
    if (!blocks.length) return null;
    return { id: r.uuid!, role: 'assistant', blocks };
  }
  return null;
}

function extractCommand(input: unknown): string {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    if (typeof o.command === 'string') return o.command;
    if (typeof o.file_path === 'string') return String(o.file_path);
  }
  return '';
}

// Edit/Write carregam o conteúdo antes/depois no input — extrai pra render de
// diff colorido. Edit: old_string/new_string. Write: content (old vazio).
export function diffOf(name: unknown, input: unknown): ToolDiff | undefined {
  if (typeof name !== 'string' || !input || typeof input !== 'object') return undefined;
  const o = input as Record<string, unknown>;
  const path = typeof o.file_path === 'string' ? o.file_path : '';
  if (!path) return undefined;
  if (name === 'Edit' && typeof o.old_string === 'string' && typeof o.new_string === 'string') {
    return { path, old: o.old_string, new: o.new_string };
  }
  if (name === 'Write' && typeof o.content === 'string') {
    return { path, old: '', new: o.content };
  }
  return undefined;
}

// ExitPlanMode carrega o plano (markdown) no input.plan — extrai pra render rico
// no card da ferramenta (o plano fica invisível sem isso; squad plan-mode).
export function planOf(name: unknown, input: unknown): string | undefined {
  if (name !== 'ExitPlanMode' || !input || typeof input !== 'object') return undefined;
  const plan = (input as Record<string, unknown>).plan;
  return typeof plan === 'string' && plan.trim() ? plan : undefined;
}
