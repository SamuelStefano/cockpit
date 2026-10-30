import { detachedGroup, killGroup, platformEnv } from '../platform';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { claudeBin, cliPath } from './cli-path';
import { leanOneShotArgs } from './lean-args';
import type { TriageVerdict, TriageAction } from '../../shared/protocol';

// Os one-shots (triagem) rodam `claude -p`, que PERSISTE um JSONL de
// sessão no projects-dir do cwd. Rodando no CONFIG.workdir, esses arquivos caíam na
// MESMA pasta que o Deck lista → cada one-shot virava um "chat fantasma" na sidebar.
// Isolando o cwd num dir dedicado, o slug do projects-dir muda e o Deck nunca lista essas sessões efêmeras.
const ONESHOT_CWD = join(homedir(), '.cockpit', 'oneshot');
try { mkdirSync(ONESHOT_CWD, { recursive: true }); } catch { /* melhor esforço */ }

// Triador de prompts: quando chega um prompt com o turno atual ocupado, um
// claude headless barato (haiku, plan-mode) decide o destino. Roda como one-shot:
// sem stream, coleta o JSON final e mata a árvore. Fallback sempre 'wait' — nunca
// perde o prompt nem mata um turno por erro de classificação.
//
// IMPORTANTE: --strict-mcp-config. plan-mode NÃO impede o CARREGAMENTO das tool
// defs de MCP, só a execução. Sem a flag, cada classify/quickAnswer haiku ingeria
// ~37k tokens de defs dos ~8 MCPs do ~/.claude.json — transformava a triagem
// "barata" em cara (espelha o run principal em claude.ts).

// Rastreio por sessionKey pra o stop poder matar SÓ os side-runs daquela sessão
// (o stop antes só matava o thread principal; classify/quickAnswer seguiam vivos e
// a quick-answer ainda fazia broadcast depois). Bucket '_' = sem sessão (shutdown).
const sideChildren = new Map<string, Set<ChildProcess>>();
function track(key: string, c: ChildProcess) {
  let s = sideChildren.get(key); if (!s) { s = new Set(); sideChildren.set(key, s); }
  s.add(c);
}
function untrack(key: string, c: ChildProcess) {
  const s = sideChildren.get(key); if (s) { s.delete(c); if (!s.size) sideChildren.delete(key); }
}
function killSet(s: Set<ChildProcess>) {
  for (const c of s) { killGroup(c); }
}

// Mata one-shots em voo no shutdown (não deixa claude órfão como na storm de :7777).
export function killSideRuns(): void {
  for (const s of sideChildren.values()) killSet(s);
  sideChildren.clear();
}

// Mata só os side-runs de UMA sessão (stop do usuário) — triagem/quick-answer em voo.
export function killSideRunsFor(sessionKey: string): void {
  const s = sideChildren.get(sessionKey);
  if (s) { killSet(s); sideChildren.delete(sessionKey); }
}

function miniEnv(): NodeJS.ProcessEnv {
  return { ...platformEnv(), PATH: cliPath(), HOME: process.env.HOME, LANG: process.env.LANG ?? 'en_US.UTF-8', TERM: 'dumb' };
}

// Executa `claude -p` haiku plan-mode e devolve o campo .result (texto). '' em erro/timeout.
function oneShot(prompt: string, timeoutMs: number, cap = 65536, key = '_', extra: string[] = []): Promise<string> {
  return new Promise((resolve) => {
    const args = ['-p', prompt, '--model', 'haiku', '--effort', 'low', '--permission-mode', 'plan', '--strict-mcp-config', '--output-format', 'json', ...extra];
    let child: ChildProcess;
    try {
      child = spawn(claudeBin(), args, { cwd: ONESHOT_CWD, env: miniEnv(), shell: false, detached: detachedGroup, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { resolve(''); return; }
    track(key, child);
    let out = '';
    child.stdout!.on('data', (d) => { out += String(d); if (out.length > cap) out = out.slice(-cap); });
    let done = false;
    const finish = (v: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      untrack(key, child);
      killGroup(child);
      resolve(v);
    };
    const timer = setTimeout(() => finish(''), timeoutMs);
    child.on('error', () => finish(''));
    child.on('close', () => {
      try {
        const obj = JSON.parse(out);
        finish(typeof obj.result === 'string' ? obj.result : '');
      } catch { finish(''); }
    });
  });
}

export const TRIAGE_SYSTEM_PROMPT = 'Você classifica prompts e responde só o JSON pedido.';

// The classifier only reads the three quoted strings in its prompt and answers JSON.
export function classifyArgs(on?: boolean): string[] {
  return leanOneShotArgs(TRIAGE_SYSTEM_PROMPT, on);
}

// The quick answer keeps the default system prompt, tools and the user's settings
// (it may search the web, and it speaks in the user's configured style); it only
// stops leaving a ghost transcript in ONESHOT_CWD.
export const QUICK_ANSWER_ARGS: readonly string[] = ['--no-session-persistence'];

export function parseVerdict(raw: string): TriageVerdict {
  const fallback: TriageVerdict = { action: 'wait', reason: 'triagem indisponível — enfileirado' };
  if (!raw) return fallback;
  const m = raw.match(/\{[\s\S]*\}/); // o modelo às vezes embrulha em ```json
  if (!m) return fallback;
  try {
    const o = JSON.parse(m[0]) as { action?: string; reason?: string };
    const a = o.action as TriageAction;
    if (a === 'wait' || a === 'answer' || a === 'priority' || a === 'merge') {
      return { action: a, reason: String(o.reason ?? '').slice(0, 80) };
    }
  } catch { /* não-JSON */ }
  return fallback;
}

export async function classify(currentPrompt: string, currentWork: string, newPrompt: string, sessionKey = '_'): Promise<TriageVerdict> {
  const p = [
    'Você é um TRIADOR de prompts. O assistente está NO MEIO de um turno e chegou um prompt novo.',
    'Classifique a relação do PROMPT_NOVO com o TRABALHO_ATUAL.',
    'TRABALHO_ATUAL (instrução em execução): ' + JSON.stringify(currentPrompt.slice(0, 600)),
    'PROGRESSO_PARCIAL: ' + JSON.stringify(currentWork.slice(0, 800)),
    'PROMPT_NOVO: ' + JSON.stringify(newPrompt.slice(0, 600)),
    'AÇÕES:',
    '- answer: pergunta independente e trivial, dá pra responder SEM tocar no trabalho atual.',
    '- wait: pode esperar o turno atual terminar (roda depois).',
    '- priority: urgente, vale INTERROMPER o turno atual agora.',
    '- merge: complementa/corrige o trabalho atual, deve ser tratado em seguida como continuação.',
    'Na dúvida use wait. priority SÓ se claramente urgente — interromper custa o turno em andamento.',
    'Responda SÓ com JSON, sem texto fora: {"action":"wait|answer|priority|merge","reason":"<=8 palavras"}',
  ].join('\n');
  return parseVerdict(await oneShot(p, 8000, 8192, sessionKey, classifyArgs()));
}

export async function quickAnswer(newPrompt: string, sessionKey = '_'): Promise<string> {
  const p = 'Responda de forma curta e direta. A pessoa fez esta pergunta enquanto outra tarefa roda em paralelo, então seja conciso:\n\n' + newPrompt;
  return (await oneShot(p, 60000, 262144, sessionKey, [...QUICK_ANSWER_ARGS])).trim();
}

const BUILDER_TIMEOUT_MS = 90_000;
const BUILDER_CAP = 262144;

// The agent builder is a text-only conversation: lean args are forced on whatever
// CONFIG.leanOneShots says, so the model never gets tools while it reads a stranger's template text.
export async function agentBuilderTurn(system: string, prompt: string, sessionKey = '_'): Promise<string> {
  const args = ['--model', 'sonnet', ...leanOneShotArgs(system, true)];
  return (await oneShot(prompt, BUILDER_TIMEOUT_MS, BUILDER_CAP, sessionKey, args)).trim();
}
