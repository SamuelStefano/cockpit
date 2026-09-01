import { broadcast } from './broadcast';
import { recordIncident } from './incidents';
import { threadIsMarathon, MARATHON_TOTAL_CAP_MS } from './marathon';
import { threads, stopSession } from './threads';

// Tetos do reaper. Só SILÊNCIO condena um turno, e o teto depende de haver tool em
// voo: mudo SEM tool aberta = o modelo travou ("garimpando" eterno); mudo COM tool
// aberta = build/teste/subagente longo, que fica minutos sem emitir frame e é
// trabalho legítimo. O teto por TEMPO DE VIDA era 45min e matava turno saudável em
// pleno progresso — o Deck existe pra disparar trabalho longo e fechar a aba, e sem
// browser o frame de erro não chegava a ninguém: era o "o turno só roda com a
// janela aberta". Fica só como rede final contra run desgovernado.
export const REAPER_SILENCE_CAP_MS = 15 * 60_000;
export const REAPER_TOOL_SILENCE_CAP_MS = 90 * 60_000;
export const REAPER_TOTAL_CAP_MS = 8 * 60 * 60_000;

export type StaleReason = 'silence' | 'tool' | 'total';
export interface StaleVerdict { key: string; reason: StaleReason; ms: number }

// Pura (testável): decide quais chaves reapar e por quê. lastFrameAt ausente → usa
// startedAt (turno que nunca emitiu frame conta silêncio desde o início).
// openToolsAt = quando cada tool AINDA ABERTA começou. Recebe os instantes, não a
// contagem: um tool_use sem tool_result (subagente morto, parse perdido) ficaria
// contado como "em voo" pelo resto do turno e rebaixaria o teto de silêncio de 15
// pra 90min pra sempre. Tool aberta há mais que o teto dela não conta como trabalho.
export function findStaleThreads(
  now: number,
  entries: Iterable<[string, { startedAt: number; lastFrameAt?: number; openToolsAt?: number[]; marathon?: boolean }]>,
  caps: { silence?: number; toolSilence?: number; total?: number } = {},
): StaleVerdict[] {
  const silenceCap = caps.silence ?? REAPER_SILENCE_CAP_MS;
  const toolCap = caps.toolSilence ?? REAPER_TOOL_SILENCE_CAP_MS;
  const totalCap = caps.total ?? REAPER_TOTAL_CAP_MS;
  const stale: StaleVerdict[] = [];
  for (const [key, t] of entries) {
    const silentFor = now - (t.lastFrameAt ?? t.startedAt);
    const aliveFor = now - t.startedAt;
    const busy = (t.openToolsAt ?? []).some((at) => now - at < toolCap);
    // A maratona só abre mão do teto de VIDA. Os de silêncio seguem valendo: turno
    // mudo está travado, não longo — e é justamente na maratona que ninguém olha.
    const lifeCap = t.marathon ? MARATHON_TOTAL_CAP_MS : totalCap;
    if (silentFor >= (busy ? toolCap : silenceCap)) stale.push({ key, reason: busy ? 'tool' : 'silence', ms: silentFor });
    else if (aliveFor >= lifeCap) stale.push({ key, reason: 'total', ms: aliveFor });
  }
  return stale;
}

// Só constata a morte. A promessa de retomada é do autoResume, que é quem sabe se
// ela vai acontecer de fato (a fila do usuário tem prioridade e pode ganhar a
// corrida) — prometer aqui virava mentira na tela.
const REAP_MESSAGE: Record<StaleReason, string> = {
  silence: 'O turno ficou mudo tempo demais e foi encerrado.',
  tool: 'Uma ferramenta travou e o turno foi encerrado.',
  total: 'O turno passou do tempo máximo de vida e foi encerrado.',
};

export function reapStaleRuns(): void {
  const now = Date.now();
  const snapshot = [...threads]
    // Já marcado = kill em andamento (nosso ou do usuário). O thread só sai de
    // `threads` no onClose, que pode demorar — ou não vir, se a tool travada segura
    // o processo. Sem esta guarda o reaper re-mataria a mesma chave a cada passada,
    // duplicando bolha de erro e incidente a cada minuto.
    .filter(([, t]) => !t.reaped && !t.stopped)
    .map(([key, t]) =>
      [key, { startedAt: t.startedAt, lastFrameAt: t.lastFrameAt, openToolsAt: [...t.toolStart.values()], marathon: threadIsMarathon(key, t.sessionId) }] as [string, { startedAt: number; lastFrameAt?: number; openToolsAt: number[]; marathon: boolean }]);
  for (const v of findStaleThreads(now, snapshot)) {
    const thread = threads.get(v.key);
    if (!thread) continue;
    // Marca reaped ANTES do kill: o onClose usa a marca pra retomar o turno sozinho.
    // Antes o reaper só passava por stopSession, então o turno ficava indistinguível
    // de um stop do usuário — morria sem retomada, sem registro e (sem browser) sem
    // ninguém pra ver o erro.
    thread.reaped = v.reason;
    console.error(`[reaper] ${v.key}: ${v.reason} há ${Math.round(v.ms / 1000)}s`);
    recordIncident({ kind: 'reaped', sessionKey: v.key, sessionId: thread.sessionId, detail: `${v.reason} há ${Math.round(v.ms / 1000)}s, ${thread.tools.length} tools` });
    broadcast({ t: 'error', sessionKey: v.key, message: REAP_MESSAGE[v.reason] });
    stopSession(v.key);
  }
}

let reaperTimer: ReturnType<typeof setInterval> | null = null;
// Varre a cada minuto. unref: o timer não segura o event loop no shutdown.
export function startRunReaper(intervalMs = 60_000): void {
  if (reaperTimer) return;
  reaperTimer = setInterval(reapStaleRuns, intervalMs);
  reaperTimer.unref?.();
}
