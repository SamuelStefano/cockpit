import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { systemPrompt } from './prompt';
import { cliPath } from '../engine/cli-path';
import type { HarnessContext, HarnessEvent } from '../../shared/protocol';

// Motor de PLANO: roda a task pelo mesmo binário `claude` que o Deck já usa, com env
// MÍNIMO (sem ANTHROPIC_API_KEY) → o CLI cai no OAuth do plano (~/.claude), como os
// chats normais. Zero custo em dólar (cota do plano). Legítimo — é o que o Deck já faz.
//
// Trade-off medido: o CLI injeta ~10k tokens de scaffolding do Claude Code por task
// (mesmo com --exclude-dynamic-system-prompt-sections + --strict-mcp-config). Na cota
// do plano isso é de graça, mas come cota mais rápido que o motor de API enxuto.

// cwd neutro (sem CLAUDE.md de projeto) pra não injetar instruções de repo no contexto.
const CWD = join(homedir(), '.cockpit', 'harness-cwd');
const TIMEOUT_MS = 180_000;

export interface PlanResult {
  status: 'done' | 'error';
  resultText?: string;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

interface ResultUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}
interface StreamObj {
  type?: string;
  event?: { type?: string; delta?: { type?: string; text?: string } };
  result?: unknown;
  usage?: ResultUsage;
  is_error?: boolean;
  subtype?: string;
}

// Pura e testável: interpreta uma linha NDJSON do stream-json do CLI.
export function parsePlanEvent(obj: StreamObj):
  | { kind: 'text'; text: string }
  | { kind: 'final'; result: PlanResult }
  | null {
  if (obj.type === 'stream_event' && obj.event?.type === 'content_block_delta' && obj.event.delta?.type === 'text_delta') {
    return { kind: 'text', text: obj.event.delta.text ?? '' };
  }
  if (obj.type === 'result') {
    const u = obj.usage ?? {};
    const inTok = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    const ok = !obj.is_error && obj.subtype === 'success';
    return {
      kind: 'final',
      result: {
        status: ok ? 'done' : 'error',
        resultText: typeof obj.result === 'string' ? obj.result : undefined,
        inputTokens: inTok,
        outputTokens: u.output_tokens ?? 0,
        error: ok ? undefined : (typeof obj.result === 'string' ? obj.result : obj.subtype ?? 'erro no CLI'),
      },
    };
  }
  return null;
}

function planEnv(): NodeJS.ProcessEnv {
  // SEM ANTHROPIC_API_KEY: força o CLI a usar o OAuth do plano em vez de pay-as-you-go.
  return { PATH: cliPath(), HOME: process.env.HOME, LANG: process.env.LANG ?? 'en_US.UTF-8', TERM: 'dumb' };
}

export function runOnPlan(opts: { model: string; prompt: string; context: HarnessContext; onEvent: (e: HarnessEvent) => void }): Promise<PlanResult> {
  const { model, prompt, context, onEvent } = opts;
  try { mkdirSync(CWD, { recursive: true }); } catch { /* já existe */ }

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--strict-mcp-config',
    '--exclude-dynamic-system-prompt-sections',
    // O prompt carrega texto que o Deck NÃO produziu — transcript de sessão, que por
    // sua vez pode conter README, página web ou comentário de PR que o agente leu.
    // Sem restrição o CLI nasce com todas as tools, e o HOME herdado traz o
    // `defaultMode: bypassPermissions` do settings do usuário: uma instrução plantada
    // nesse texto rodaria sem nenhuma confirmação. O motor só precisa devolver TEXTO.
    // Testado: o modelo recusou a injeção — mas recusa é julgamento do modelo, não
    // fronteira, e least privilege não depende de o modelo acertar toda vez.
    //
    // 04/09/2026: medido que estas duas flags sozinhas NÃO fecham. Elas bloqueiam
    // escrita (`touch` não criou arquivo), mas o filho continua LENDO arquivo
    // arbitrário — um canário em /tmp voltou inteiro no texto da resposta. E o
    // texto da resposta é justamente o que sai daqui. Só a negação explícita por
    // tool bloqueou a leitura.
    '--allowed-tools', '',
    '--permission-mode', 'default',
    '--disallowedTools', 'Read Bash Glob Grep WebFetch WebSearch Edit Write NotebookEdit Task',
    '--model', model,
    '--system-prompt', systemPrompt(context),
  ];

  return new Promise<PlanResult>((resolve) => {
    let settled = false;
    const done = (r: PlanResult) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } };

    const child = spawn('claude', args, { cwd: CWD, env: planEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* já morreu */ } done({ status: 'error', inputTokens: 0, outputTokens: 0, error: 'timeout no CLI do plano' }); }, TIMEOUT_MS);

    let buf = '';
    let final: PlanResult | null = null;
    child.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString();
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let obj: StreamObj;
        try { obj = JSON.parse(line) as StreamObj; } catch { continue; }
        const ev = parsePlanEvent(obj);
        if (!ev) continue;
        if (ev.kind === 'text') onEvent({ kind: 'text', text: ev.text });
        else final = ev.result;
      }
    });

    let stderr = '';
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
    child.on('error', (e) => done({ status: 'error', inputTokens: 0, outputTokens: 0, error: `falha ao spawnar claude: ${e.message}` }));
    child.on('close', () => {
      if (final) done(final);
      else done({ status: 'error', inputTokens: 0, outputTokens: 0, error: stderr.trim().slice(0, 300) || 'o CLI do plano fechou sem resultado' });
    });
  });
}
