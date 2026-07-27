import type { ClientMsg, ServerMsg } from '../../../../shared/protocol';

// Ponte do bench com o WS. O card fica fundo na árvore de render (dentro do
// CodeBlock) e o socket é do useCockpit — mesmo padrão do [[refine-bus]], mas
// aqui é pedido→resposta, então cada build carrega um id e vira uma promise.
export interface BenchBundle { js: string; css: string; ms: number }

type Pending = { ok: (b: BenchBundle) => void; fail: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

let sender: ((m: ClientMsg) => boolean) | null = null;
const pending = new Map<string, Pending>();
let seq = 0;

// O tailwind do repo alvo tem timeout de 120s no servidor; abaixo disso o card
// desistiria antes de o servidor responder e o build ficaria órfão.
const TIMEOUT_MS = 130_000;

export function setBenchSender(fn: ((m: ClientMsg) => boolean) | null): void {
  sender = fn;
}

export function buildBench(repo: string, code: string): Promise<BenchBundle> {
  if (!sender) return Promise.reject(new Error('sem conexão com o servidor'));
  const buildId = `b${Date.now().toString(36)}${seq++}`;
  return new Promise<BenchBundle>((ok, fail) => {
    // O pending entra ANTES do envio: um servidor que respondesse na mesma volta
    // do event loop encontraria o mapa vazio e o build se perderia.
    const timer = setTimeout(() => { pending.delete(buildId); fail(new Error('build expirou')); }, TIMEOUT_MS);
    pending.set(buildId, { ok, fail, timer });
    if (!sender?.({ t: 'bench-build', buildId, repo, code })) {
      pending.delete(buildId);
      clearTimeout(timer);
      fail(new Error('sem conexão com o servidor'));
    }
  });
}

// O socket caiu com builds em voo: sem isto o card ficaria "compilando…" até o
// timeout de 130s, sendo que a resposta nunca vai chegar.
export function failAllBenchPending(reason = 'conexão caiu durante o build'): void {
  const all = [...pending.values()];
  pending.clear();
  for (const p of all) { clearTimeout(p.timer); p.fail(new Error(reason)); }
}

export function benchDispatch(msg: ServerMsg): void {
  if (msg.t !== 'bench-bundle' && msg.t !== 'bench-error') return;
  const p = pending.get(msg.buildId);
  if (!p) return;
  pending.delete(msg.buildId);
  clearTimeout(p.timer);
  if (msg.t === 'bench-error') p.fail(new Error(msg.error));
  else p.ok({ js: msg.js, css: msg.css, ms: msg.ms });
}
