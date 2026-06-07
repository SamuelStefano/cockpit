import { spawn, type ChildProcess } from 'node:child_process';
import { CONFIG } from '../config';
import type { TriageVerdict, TriageAction } from '../../shared/protocol';

// Triador de prompts: quando chega um prompt com o turno atual ocupado, um
// claude headless barato (haiku, plan-mode = ZERO tools) decide o destino. Roda
// como one-shot: sem stream, coleta o JSON final e mata a árvore. Fallback sempre
// 'wait' — nunca perde o prompt nem mata um turno por erro de classificação.

const sideChildren = new Set<ChildProcess>();

// Mata one-shots em voo no shutdown (não deixa claude órfão como na storm de :7777).
export function killSideRuns(): void {
  for (const c of sideChildren) {
    try { if (c.pid) process.kill(-c.pid, 'SIGKILL'); } catch { /* já morto */ }
  }
  sideChildren.clear();
}

function miniEnv(): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG ?? 'en_US.UTF-8', TERM: 'dumb' };
}

// Executa `claude -p` haiku plan-mode e devolve o campo .result (texto). '' em erro/timeout.
function oneShot(prompt: string, timeoutMs: number, cap = 65536): Promise<string> {
  return new Promise((resolve) => {
    const args = ['-p', prompt, '--model', 'haiku', '--permission-mode', 'plan', '--output-format', 'json'];
    let child: ChildProcess;
    try {
      child = spawn('claude', args, { cwd: CONFIG.workdir, env: miniEnv(), shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { resolve(''); return; }
    sideChildren.add(child);
    let out = '';
    child.stdout!.on('data', (d) => { out += String(d); if (out.length > cap) out = out.slice(-cap); });
    let done = false;
    const finish = (v: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sideChildren.delete(child);
      try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); } catch { /* já morto */ }
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

export async function classify(currentPrompt: string, currentWork: string, newPrompt: string): Promise<TriageVerdict> {
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
  return parseVerdict(await oneShot(p, 20000, 8192));
}

export async function quickAnswer(newPrompt: string): Promise<string> {
  const p = 'Responda de forma curta e direta. A pessoa fez esta pergunta enquanto outra tarefa roda em paralelo, então seja conciso:\n\n' + newPrompt;
  return (await oneShot(p, 60000, 262144)).trim();
}
