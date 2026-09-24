import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { startRun, catchSpawn, routeSend, isSilentDeath, isCleanTurnClose, resumeOrphanRuns, drainParked, runParkedInBackground, runParkedNow, startParkedDrainer, acceptResumeOffer, hasResumeOffer, AUTO_RESUME_CAP, deliverToOrchestratorPane, orchestratorPaneTarget } from './runs';
import { readOrchestratorSync, isTmuxAliveSync } from '../canvas/orchestrator';
import { hasTerm, openTerm, inputTerm } from '../terminals';
import { threads, killAllRuns } from './threads';
import { reapStaleRuns, REAPER_SILENCE_CAP_MS, REAPER_TOOL_SILENCE_CAP_MS, REAPER_TOTAL_CAP_MS } from './reaper';
import { takeOrphanRuns } from './recover';
import { recordIncident } from './incidents';
import { isAwaiting, setAwaiting, clearAllAwaiting } from './awaiting';
import { broadcast, send } from './broadcast';
import { run } from '../engine/claude';
import { parkedHeads, shiftParked, unshiftParked, addParked, findParked, takeParked, promoteParked, isQueuePaused, type ParkedItem } from './parked';
import { resumableId } from './resume';
import { quotaHold } from './quota';
import { getLastPlanUsage } from './usage-plan';
import { classify } from '../engine/triage';
import { resetCooldownState, resetColdInflight, coldInflightCount, acquireCold, COOLDOWN_AFTER_RESET_MS, CTX_HARD } from './ctx-guard';
import { noteExternalKill, resetExternalKills, EXTERNAL_POLL_MS, EXTERNAL_QUIET_MS } from './kill-class';

// O gate de contexto lê a última amostra de uso do SQLite. No teste isso tem que
// ser determinístico: sem mock ele consultaria o cockpit.db real do Samuel e o
// veredito mudaria conforme o histórico da máquina.
const usageRow = vi.hoisted(() => ({ value: null as { ctxTokens: number; ts: number; model: string | null } | null }));
vi.mock('../db', () => ({ lastUsageOf: () => usageRow.value }));

vi.mock('../engine/claude', () => ({
  run: vi.fn(() => ({ kill: vi.fn() })),
  // Sem MCP configurado no teste: a expansão do sentinel devolve a seleção como veio.
  resolveMcpSelection: (names?: string[]) => names,
}));
// Fila estacionada e teto de tokens mockados: o teste não pode ler/escrever o
// parked.json real do usuário nem depender da quota da conta.
vi.mock('./parked', () => ({
  parkedHeads: vi.fn(() => []), shiftParked: vi.fn(), unshiftParked: vi.fn(() => 1),
  findParked: vi.fn(() => null), takeParked: vi.fn(() => null), promoteParked: vi.fn(() => true),
  addParked: vi.fn(() => ({ id: 'pk-mock' })), parkedView: vi.fn(() => []), isQueuePaused: vi.fn(() => false),
  setQueuePaused: vi.fn(), MAX_PARKED_ATTEMPTS: 3,
}));
// Por padrão todo resumeId é vivo; o teste do transcript morto sobrescreve.
vi.mock('./resume', () => ({ resumableId: vi.fn((id?: string) => id) }));
vi.mock('./quota', async (orig) => ({ ...(await orig<typeof import('./quota')>()), quotaHold: vi.fn(() => 0) }));
vi.mock('./usage-plan', async (orig) => ({ ...(await orig<typeof import('./usage-plan')>()), getLastPlanUsage: vi.fn(() => null) }));
vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('./translate', () => ({ translate: vi.fn() }));
vi.mock('./awaiting', () => {
  // Latch em memória: o teste não pode escrever o awaiting.json real do usuário
  // (um latch preso ali travaria a fila da máquina depois da suíte).
  const keys = new Set<string>();
  return {
    isAwaiting: (k: string) => keys.has(k),
    setAwaiting: (k: string) => { keys.add(k); },
    clearAwaiting: (k: string) => { keys.delete(k); },
    clearAllAwaiting: () => { keys.clear(); },
  };
});

vi.mock('../summary', () => ({ summarize: vi.fn(async () => {}) }));
vi.mock('../engine/triage', () => ({ classify: vi.fn(), quickAnswer: vi.fn(), killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));
vi.mock('../engine/suggest', () => ({ suggestFollowups: vi.fn(async () => []) }));
vi.mock('./incidents', () => ({ recordIncident: vi.fn() })); // teste não escreve no log real de incidentes
vi.mock('./recover', () => ({ markRunLive: vi.fn(), clearRunLive: vi.fn(), takeOrphanRuns: vi.fn(() => []) }));
// Orchestrator identity/pane: undefined/dead by default so the existing suite's
// many startRun calls take the normal `run()` path unchanged; the twin-process
// guard tests below override these per-case.
vi.mock('../canvas/orchestrator', () => ({
  readOrchestratorSync: vi.fn(() => undefined),
  isTmuxAliveSync: vi.fn(() => false),
}));
vi.mock('../terminals', () => ({
  hasTerm: vi.fn(() => false),
  openTerm: vi.fn(() => true),
  inputTerm: vi.fn(),
}));
// Memória mockada como "sempre ok" por padrão: sem isto os testes leriam o
// /proc/meminfo REAL da box (que roda apertada de propósito) e o gate de D1/D2/D5
// ficaria flaky. Os describes de D1/D2/D5 sobrescrevem os mocks que precisam.
const memInfoMock = vi.hoisted(() => ({ value: { availMb: 100_000, swapFreeMb: 4000, swapTotalMb: 4096 } }));
vi.mock('./mem-guard', async (orig) => ({
  ...(await orig<typeof import('./mem-guard')>()),
  readMemInfo: vi.fn(() => memInfoMock.value),
}));

describe('startRun — latch de pergunta pendente (AskUserQuestion)', () => {
  const ws = {} as WebSocket;
  beforeEach(() => { threads.clear(); clearAllAwaiting(); vi.mocked(run).mockClear(); });

  it('estaciona um send AUTO enquanto a sessão aguarda resposta da pergunta', () => {
    setAwaiting('s1');
    startRun({ ws, sessionKey: 's1', prompt: 'flush da fila', msgId: 'm1', auto: true });
    expect(run).not.toHaveBeenCalled();
    expect(threads.has('s1')).toBe(false);
    expect(isAwaiting('s1')).toBe(true); // latch intacto até a resposta real
  });

  it('send MANUAL limpa o latch, roda e o onClose drena o estacionado', () => {
    setAwaiting('s2');
    startRun({ ws, sessionKey: 's2', prompt: 'auto estacionado', auto: true });
    expect(run).not.toHaveBeenCalled();
    startRun({ ws, sessionKey: 's2', prompt: 'minha resposta à pergunta' });
    expect(isAwaiting('s2')).toBe(false);
    expect(run).toHaveBeenCalledOnce();
    // Fecha o turno da resposta: o item estacionado vira o próximo turno.
    vi.mocked(run).mock.calls[0][0].onClose?.();
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.mocked(run).mock.calls[1][0].prompt).toBe('auto estacionado');
  });

  it('send AUTO sem latch roda normalmente', () => {
    startRun({ ws, sessionKey: 's3', prompt: 'fila normal', auto: true });
    expect(run).toHaveBeenCalledOnce();
  });

  // Bug do label retroativo: a bolha em voo nascia sem modelo e o label caía no
  // seletor vivo, mudando as bolhas antigas ao trocar de modelo. O 'started' passa
  // a carregar o modelo pedido pra o cliente carimbar a bolha desde o início.
  it('carimba o modelo pedido no frame started', () => {
    startRun({ ws, sessionKey: 's4', prompt: 'oi', model: 'claude-opus-4-8' });
    const started = vi.mocked(broadcast).mock.calls.map((c) => c[0]).find((m: any) => m.t === 'started' && m.sessionKey === 's4') as any;
    expect(started?.model).toBe('claude-opus-4-8');
  });
});

// O coalesce junta prompts CONSECUTIVOS da fila in-turn num único --resume, e só
// pode fazer isso quando a config do turno é idêntica: o batch inteiro roda com a
// config do PRIMEIRO. O comparador listava os params à mão e tinha esquecido o
// `effort` — dois prompts com esforço diferente viravam um turno só, no esforço do
// primeiro, sem nada no log. Agora ele deriva das chaves de RunParams.
describe('coalesce da fila in-turn', () => {
  const ws = {} as WebSocket;
  const closeLast = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
  const lastRun = () => vi.mocked(run).mock.calls.at(-1)![0];

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    vi.mocked(run).mockClear();
    vi.mocked(classify).mockResolvedValue({ action: 'wait', reason: 'depois' });
  });

  it('funde prompts consecutivos de config idêntica', async () => {
    startRun({ ws, sessionKey: 'c1', prompt: 'turno em andamento', effort: 'low' });
    await routeSend({ ws, sessionKey: 'c1', prompt: 'primeiro', effort: 'low' });
    await routeSend({ ws, sessionKey: 'c1', prompt: 'segundo', effort: 'low' });
    closeLast();
    expect(lastRun().prompt).toBe('primeiro\n\nsegundo');
    expect(lastRun().effort).toBe('low');
  });

  it('não funde prompts de esforço diferente', async () => {
    startRun({ ws, sessionKey: 'c2', prompt: 'turno em andamento', effort: 'low' });
    await routeSend({ ws, sessionKey: 'c2', prompt: 'primeiro', effort: 'low' });
    await routeSend({ ws, sessionKey: 'c2', prompt: 'segundo', effort: 'high' });
    closeLast();
    // Só o primeiro sobe; o de 'high' fica pro turno seguinte, no esforço dele.
    expect(lastRun().prompt).toBe('primeiro');
    expect(lastRun().effort).toBe('low');
    closeLast();
    expect(lastRun().prompt).toBe('segundo');
    expect(lastRun().effort).toBe('high');
  });
});

// canvas review #593 third pass item 4: dispatch.ts's 'send' case can reroute
// a canvas prompt bar's send onto a DIFFERENT live thread key
// (resolveThreadKey found the real run under a cron/flow key). routeSend's
// "prompt grande demais" check fires BEFORE any 'triage' broadcast, so the
// client's aliasRoutedKey correlation (which learns the routed key FROM that
// triage frame) never gets a chance to run for it — `displayKey` is the
// escape hatch: report this one early error under the ORIGINAL key instead.
describe('routeSend — displayKey correlaciona a recusa de prompt grande cedo demais pro triage', () => {
  const ws = {} as WebSocket;
  const big = 'x'.repeat(200_000); // acima de CONFIG.maxPromptBytes (100_000)

  beforeEach(() => { threads.clear(); vi.mocked(send).mockClear(); });

  it('sem displayKey, reporta sob a própria sessionKey (default = sessionKey)', async () => {
    await routeSend({ ws, sessionKey: 's1', prompt: big });
    expect(send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'error', sessionKey: 's1', message: 'prompt grande demais' }));
  });

  it('com displayKey (sessão roteada pra outra chave), reporta sob a chave ORIGINAL', async () => {
    await routeSend({ ws, sessionKey: 'cron-nightly', prompt: big, displayKey: 's1' });
    expect(send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'error', sessionKey: 's1', message: 'prompt grande demais' }));
  });
});

describe('morte silenciosa do turno — aviso + retomada automática', () => {
  const ws = {} as WebSocket;
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
  const errors = () => vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === 'error');

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
  });

  it('detecta só o fechamento sem result e sem stop', () => {
    expect(isSilentDeath({})).toBe(true);
    expect(isSilentDeath({ endReason: 'success' })).toBe(false);
    expect(isSilentDeath({ endReason: 'error_max_budget' })).toBe(false);
    expect(isSilentDeath({ stopped: true })).toBe(false);
  });

  it('avisa e retoma com os MESMOS parâmetros do turno morto', () => {
    startRun({ ws, sessionKey: 'k1', prompt: 'trabalho longo', resumeId: 'sess-1', mode: 'plan', model: 'opus', maxBudgetUsd: 5, bypass: true, role: 'admin', disallowedSkills: ['x'], mcps: ['mcp1'], effort: 'high' });
    closeLastRun();
    // Constatação da morte + promessa de retomada (esta última só sai porque a
    // retomada realmente aconteceu).
    expect(errors().map((m: any) => m.message)).toEqual([
      expect.stringContaining('caiu antes de terminar'),
      'Retomando de onde parou…',
    ]);
    expect(run).toHaveBeenCalledTimes(2);
    const resumed = vi.mocked(run).mock.calls[1][0];
    expect(resumed.resumeId).toBe('sess-1');
    expect(resumed.prompt).toContain('Continue exatamente de onde parou');
    expect(resumed).toMatchObject({ mode: 'plan', model: 'opus', maxBudgetUsd: 5, bypass: true, role: 'admin', effort: 'high' });
  });

  it('fechamento saudável não avisa nem retoma', () => {
    startRun({ ws, sessionKey: 'k2', prompt: 'trabalho', resumeId: 'sess-2' });
    threads.get('k2')!.endReason = 'success';
    closeLastRun();
    expect(errors()).toHaveLength(0);
    expect(run).toHaveBeenCalledOnce();
  });

  it('stop do usuário não vira retomada', () => {
    startRun({ ws, sessionKey: 'k3', prompt: 'trabalho', resumeId: 'sess-3' });
    threads.get('k3')!.stopped = true;
    closeLastRun();
    expect(errors()).toHaveLength(0);
    expect(run).toHaveBeenCalledOnce();
  });

  // Kill do reaper usa stopped (pra não notificar "concluído") mas NÃO é stop do
  // usuário: antes o turno reapado morria sem retomada e sem ninguém ver.
  it('turno reapado retoma sozinho', () => {
    startRun({ ws, sessionKey: 'k3b', prompt: 'trabalho longo', resumeId: 'sess-3b' });
    Object.assign(threads.get('k3b')!, { stopped: true, reaped: 'silence' });
    closeLastRun();
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.mocked(run).mock.calls[1][0].prompt).toContain('Continue exatamente de onde parou');
  });

  it('retoma no máximo AUTO_RESUME_CAP vezes seguidas', () => {
    startRun({ ws, sessionKey: 'k4', prompt: 'trabalho', resumeId: 'sess-4' });
    for (let i = 0; i <= AUTO_RESUME_CAP + 1; i++) closeLastRun();
    expect(run).toHaveBeenCalledTimes(1 + AUTO_RESUME_CAP);
    // Esgotado ≠ perdido: o turno vira oferta de retomada com um clique.
    const offer = vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === 'resume-offer').at(-1);
    expect(offer).toMatchObject({ sessionKey: 'k4', reason: 'exhausted' });
  });

  it('turno saudável zera a cota — falha nova volta a ter direito a retomada', () => {
    startRun({ ws, sessionKey: 'k5', prompt: 'trabalho', resumeId: 'sess-5' });
    closeLastRun();                                   // 1ª morte: retoma
    expect(run).toHaveBeenCalledTimes(2);
    threads.get('k5')!.endReason = 'success';
    closeLastRun();                                   // fecha bem: zera
    startRun({ ws, sessionKey: 'k5', prompt: 'outro trabalho', resumeId: 'sess-5' });
    closeLastRun();                                   // morte nova: retoma de novo
    expect(vi.mocked(run).mock.calls.at(-1)![0].prompt).toContain('Continue exatamente de onde parou');
  });

  it('não retoma quando a sessão aguarda resposta do usuário', () => {
    startRun({ ws, sessionKey: 'k6', prompt: 'trabalho', resumeId: 'sess-6' });
    setAwaiting('k6');
    closeLastRun();
    expect(run).toHaveBeenCalledOnce();
  });

  it('não retoma turno sem sessionId (sem --resume possível)', () => {
    startRun({ ws, sessionKey: 'k7', prompt: 'trabalho' });
    closeLastRun();
    expect(run).toHaveBeenCalledOnce();
  });

  // Regressão: killAllRuns (shutdown / guarda de pressão) fechava o turno sem marcar
  // stopped, então cada onClose parecia morte silenciosa e subia um turno novo — em
  // cima do processo saindo ou da VPS sob pressão, uma retomada por sessão.
  it('kill nosso (killAllRuns) não vira retomada automática', () => {
    startRun({ ws, sessionKey: 'k8', prompt: 'trabalho', resumeId: 'sess-8' });
    startRun({ ws, sessionKey: 'k9', prompt: 'outro', resumeId: 'sess-9' });
    killAllRuns();
    vi.mocked(run).mock.calls.forEach((c) => c[0].onClose?.());
    expect(run).toHaveBeenCalledTimes(2);
    expect(errors()).toHaveLength(0);
  });
});

describe('isCleanTurnClose — o que server/canvas/flows.ts pode encadear', () => {
  const clean = { endReason: 'success', text: 'resultado real' };
  const okFlags = { silent: false, authBurned: false, quotaBurned: false };

  it('aprova um fechamento limpo com endReason success e texto', () => {
    expect(isCleanTurnClose(clean, okFlags)).toBe(true);
  });

  it('reprova endReason diferente de success (budget/max_turns/erro/ausente)', () => {
    expect(isCleanTurnClose({ ...clean, endReason: 'error_max_budget' }, okFlags)).toBe(false);
    expect(isCleanTurnClose({ ...clean, endReason: 'error_max_turns' }, okFlags)).toBe(false);
    expect(isCleanTurnClose({ ...clean, endReason: undefined }, okFlags)).toBe(false);
  });

  it('reprova stop do usuário, AskUserQuestion pendente e morte silenciosa', () => {
    expect(isCleanTurnClose({ ...clean, stopped: true }, okFlags)).toBe(false);
    expect(isCleanTurnClose({ ...clean, questioned: true }, okFlags)).toBe(false);
    expect(isCleanTurnClose(clean, { ...okFlags, silent: true })).toBe(false);
  });

  it('reprova texto que é só o aviso de auth quebrada ou o teto de tokens estourado', () => {
    expect(isCleanTurnClose(clean, { ...okFlags, authBurned: true })).toBe(false);
    expect(isCleanTurnClose(clean, { ...okFlags, quotaBurned: true })).toBe(false);
  });

  it('reprova quando o processo reportou um erro no meio do turno, mesmo com endReason success', () => {
    expect(isCleanTurnClose({ ...clean, lastError: 'algo deu errado' }, okFlags)).toBe(false);
  });

  it('reprova texto vazio', () => {
    expect(isCleanTurnClose({ ...clean, text: '  ' }, okFlags)).toBe(false);
  });
});

// O reaper é quem matava turno saudável em 45min ("o turno só roda com a janela
// aberta"). findStaleThreads cobre o veredito; aqui é a ligação com o mundo: o que
// ele lê de `threads`, a marca `reaped` e o efeito no onClose.
describe('reapStaleRuns — efeito sobre o turno vivo', () => {
  const ws = {} as WebSocket;
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
  const errors = () => vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === 'error');
  const age = (key: string, over: { startedAt?: number; lastFrameAt?: number }) => Object.assign(threads.get(key)!, over);

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(recordIncident).mockClear();
  });

  it('marca reaped, registra incidente e o onClose retoma o turno', () => {
    startRun({ ws, sessionKey: 'r1', prompt: 'trabalho longo', resumeId: 'sess-r1' });
    age('r1', { lastFrameAt: Date.now() - REAPER_SILENCE_CAP_MS - 1 });
    reapStaleRuns();
    expect(threads.get('r1')).toMatchObject({ reaped: 'silence', stopped: true });
    expect(recordIncident).toHaveBeenCalledWith(expect.objectContaining({ kind: 'reaped', sessionKey: 'r1' }));
    // Constata a morte sem prometer nada — a promessa é do autoResume.
    expect(errors()[0]).toMatchObject({ message: 'O turno ficou mudo tempo demais e foi encerrado.' });
    closeLastRun();
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.mocked(run).mock.calls[1][0].prompt).toContain('Continue exatamente de onde parou');
  });

  // O thread só sai de `threads` no onClose, que pode nem vir se a tool travada
  // segura o processo: sem a guarda, o reaper re-matava a mesma chave a cada minuto
  // e empilhava bolha de erro + incidente pra sempre.
  it('não reapa duas vezes a mesma chave', () => {
    startRun({ ws, sessionKey: 'r2', prompt: 'trabalho', resumeId: 'sess-r2' });
    age('r2', { lastFrameAt: Date.now() - REAPER_SILENCE_CAP_MS - 1 });
    reapStaleRuns();
    reapStaleRuns();
    expect(recordIncident).toHaveBeenCalledOnce();
    expect(errors()).toHaveLength(1);
  });

  it('poupa turno mudo com tool em voo (teto de tool, não de silêncio)', () => {
    startRun({ ws, sessionKey: 'r3', prompt: 'build longo', resumeId: 'sess-r3' });
    age('r3', { lastFrameAt: Date.now() - REAPER_SILENCE_CAP_MS - 1 });
    threads.get('r3')!.toolStart.set('tool-1', Date.now() - 60_000);
    reapStaleRuns();
    expect(threads.get('r3')!.reaped).toBeUndefined();
  });

  it('teto total não retoma — é a rede final contra run desgovernado', () => {
    startRun({ ws, sessionKey: 'r4', prompt: 'trabalho', resumeId: 'sess-r4' });
    age('r4', { startedAt: Date.now() - REAPER_TOTAL_CAP_MS - 1, lastFrameAt: Date.now() - 500 });
    reapStaleRuns();
    expect(threads.get('r4')!.reaped).toBe('total');
    closeLastRun();
    expect(run).toHaveBeenCalledOnce();
  });
});

// resumeOrphanRuns dispara turno SEM usuário pedindo (roda no boot, lendo disco).
// É o caminho mais arriscado do lote: um arquivo errado vira trabalho pago que
// ninguém autorizou — daí testar chave, dedupe e passagem de params.
describe('resumeOrphanRuns — turnos que o restart matou', () => {
  const orphan = (over: Record<string, unknown> = {}) => ({
    sessionKey: 'new-123', sessionId: 'sess-orfa', startedAt: Date.now() - 30_000,
    params: { mode: 'plan', model: 'opus', maxBudgetUsd: 5, bypass: true, role: 'admin', effort: 'high' },
    ...over,
  });

  beforeEach(() => {
    threads.clear();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(takeOrphanRuns).mockReturnValue([]);
  });

  it('retoma pelo sessionId (não pela key salva) com os params do turno morto', () => {
    vi.mocked(takeOrphanRuns).mockReturnValue([orphan()] as never);
    resumeOrphanRuns();
    expect(run).toHaveBeenCalledOnce();
    const c = vi.mocked(run).mock.calls[0][0];
    expect(c.resumeId).toBe('sess-orfa');
    expect(c.prompt).toContain('Continue exatamente de onde parou');
    expect(c).toMatchObject({ mode: 'plan', model: 'opus', maxBudgetUsd: 5, bypass: true, role: 'admin', effort: 'high' });
    // Chaveado pelo id real: a key 'new-123' só existia no cliente que o restart derrubou.
    expect(threads.has('sess-orfa')).toBe(true);
    expect(threads.has('new-123')).toBe(false);
  });

  it('avisa o usuário antes de retomar sozinho', () => {
    vi.mocked(takeOrphanRuns).mockReturnValue([orphan()] as never);
    resumeOrphanRuns();
    expect(vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === 'error')).toHaveLength(1);
  });

  it('ignora sessionId que não é chave válida (arquivo corrompido/editado)', () => {
    vi.mocked(takeOrphanRuns).mockReturnValue([orphan({ sessionId: '../../etc/passwd' })] as never);
    resumeOrphanRuns();
    expect(run).not.toHaveBeenCalled();
  });

  it('não retoma sessão que o usuário já reenviou na mão', () => {
    startRun({ ws: {} as WebSocket, sessionKey: 'sess-orfa', prompt: 'reenviei na mão' });
    vi.mocked(run).mockClear();
    vi.mocked(takeOrphanRuns).mockReturnValue([orphan()] as never);
    resumeOrphanRuns();
    expect(run).not.toHaveBeenCalled();
  });
});

// Bug do Samuel: com os tokens esgotados a fila disparava assim mesmo, o turno
// morria no limite e o prompt (já retirado do parked.json) sumia.
describe('fila estacionada — teto de tokens', () => {
  const ws = {} as WebSocket;
  const item = (over: Partial<ParkedItem> = {}): ParkedItem => ({ id: 'pk-1', prompt: 'roda isso', at: 1, ...over });
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
  const limited = () => vi.mocked(quotaHold).mockReturnValue(Date.now() + 60_000);

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(quotaHold).mockReturnValue(0);
    vi.mocked(isQueuePaused).mockReturnValue(false);
    vi.mocked(parkedHeads).mockReturnValue([]);
    vi.mocked(shiftParked).mockReset();
    vi.mocked(unshiftParked).mockClear();
    vi.mocked(addParked).mockClear();
    // Estado de módulo do ctx-guard: o cooldown pós-reset e o semáforo de
    // cold-start sobrevivem entre testes. Sem zerar, o `limited()` de um teste
    // arma o cooldown e o dreno do teste SEGUINTE não sai.
    resetCooldownState();
    resetColdInflight();
    startParkedDrainer(3_600_000); // liga o drainer sem tick automático no teste
  });

  it('segura a fila enquanto os tokens estão esgotados', () => {
    limited();
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's1', first: item() }]);
    drainParked();
    expect(shiftParked).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('drena assim que os tokens voltam', () => {
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's1', first: item() }]);
    vi.mocked(shiftParked).mockReturnValue(item());
    drainParked();
    expect(run).toHaveBeenCalledOnce();
    expect(vi.mocked(run).mock.calls[0][0].prompt).toBe('roda isso');
  });

  // Bug do Samuel: o item drenava e rodava, mas a fila não sumia da tela de quem não
  // está na sessão — o drainer tirava do disco sem avisar os clientes. O 'started' do
  // turno não mexe na lista de fila, então o broadcast do snapshot é o único sinal.
  it('avisa os clientes que a fila mudou ao drenar um item', () => {
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's1', first: item() }]);
    vi.mocked(shiftParked).mockReturnValue(item());
    drainParked();
    const queueMsgs = vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === 'queue');
    expect(queueMsgs.length).toBeGreaterThan(0);
  });

  // Regressão real (03/09, 19:50): a janela de 5h virou e o dreno soltou 5 sessões
  // Opus em 21ms, torrando o ciclo novo em segundos. O `quotaHold` é binário (só
  // segura em 100%), então sem teto por passada a virada da janela vira estouro.
  it('dispara no máximo um item por passada, mesmo com várias sessões na fila', () => {
    vi.mocked(parkedHeads).mockReturnValue([
      { sessionKey: 's1', first: item({ id: 'pk-1' }) },
      { sessionKey: 's2', first: item({ id: 'pk-2' }) },
      { sessionKey: 's3', first: item({ id: 'pk-3' }) },
      { sessionKey: 's4', first: item({ id: 'pk-4' }) },
      { sessionKey: 's5', first: item({ id: 'pk-5' }) },
    ]);
    vi.mocked(shiftParked).mockImplementation((k: string) => item({ id: `pk-${k}` }));
    drainParked();
    expect(run).toHaveBeenCalledOnce();
    expect(shiftParked).toHaveBeenCalledOnce();
  });

  // O teto lido só no topo do dreno deixava o resto da fila subir em cima de uma
  // quota que o turno recém-disparado já tinha estourado.
  it('para de drenar se a quota estourar durante a passada', () => {
    vi.mocked(parkedHeads).mockReturnValue([
      { sessionKey: 's1', first: item({ id: 'pk-1' }) },
      { sessionKey: 's2', first: item({ id: 'pk-2' }) },
    ]);
    vi.mocked(shiftParked).mockImplementation((k: string) => item({ id: `pk-${k}` }));
    drainParked();
    expect(run).toHaveBeenCalledOnce();
    limited(); // o turno que subiu estourou a janela
    drainParked();
    expect(run).toHaveBeenCalledOnce(); // a 2ª sessão não sobe
  });

  // Sessão pulada não gastou quota: contá-la no teto seguraria a fila sem nenhum
  // turno ter subido, trocando o estouro por uma fila parada.
  it('não gasta o teto da passada com sessão pulada', () => {
    vi.mocked(parkedHeads).mockReturnValue([
      { sessionKey: 's1', first: item({ id: 'pk-1', held: true }) }, // segurada: pulada
      { sessionKey: 's2', first: item({ id: 'pk-2' }) },
    ]);
    vi.mocked(shiftParked).mockImplementation((k: string) => item({ id: `pk-${k}` }));
    drainParked();
    expect(run).toHaveBeenCalledOnce();
    expect(vi.mocked(shiftParked).mock.calls[0][0]).toBe('s2'); // s2 teve a vez
  });

  it('devolve pro topo da fila o item cujo turno morreu no limite', () => {
    const it0 = item();
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's2', first: it0 }]);
    vi.mocked(shiftParked).mockReturnValue(it0);
    drainParked();
    limited(); // a quota estourou durante o turno
    closeLastRun();
    expect(unshiftParked).toHaveBeenCalledWith('s2', it0, true); // conta tentativa: falha "normal", não de orçamento
    expect(run).toHaveBeenCalledOnce(); // sem retomada automática em cima do limite
  });

  it('não devolve pra fila um turno que já produziu trabalho', () => {
    const it0 = item();
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's3', first: it0 }]);
    vi.mocked(shiftParked).mockReturnValue(it0);
    drainParked();
    threads.get('s3')!.text = 'terminei o que você pediu';
    limited();
    closeLastRun();
    expect(unshiftParked).not.toHaveBeenCalled();
  });

  // Autopause do canvas: mesmo que o turno já tivesse produzido algo antes de ser
  // interrompido, o item volta pra fila (foi parado à força, não terminou sozinho) —
  // e SEM contar tentativa, porque a falha não é do prompt.
  it('devolve pra fila um item budget-stopped mesmo se o turno já produziu algo, sem contar tentativa', () => {
    const it0 = item();
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's9', first: it0 }]);
    vi.mocked(shiftParked).mockReturnValue(it0);
    drainParked();
    const t = threads.get('s9')!;
    t.text = 'já tinha feito bastante coisa';
    t.budgetStopped = true;
    t.budgetStopReason = 'cpu 120% > 100%';
    closeLastRun();
    expect(unshiftParked).toHaveBeenCalledWith('s9', it0, false);
  });

  it('devolve pra fila o item que nem chegou a subir (teto de sessões)', () => {
    const it0 = item();
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 'bad key!', first: it0 }]);
    vi.mocked(shiftParked).mockReturnValue(it0);
    drainParked();
    expect(run).not.toHaveBeenCalled();
    expect(unshiftParked).toHaveBeenCalledWith('bad key!', it0);
  });

  // O item segurado é o TOPO da fila e a fila drena do topo: sem o skip, o drainer
  // redispararia pra sempre o item que já falhou 3x e nenhum item atrás dele sairia.
  it('pula o item segurado sem travar o tick', () => {
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's5', first: item({ held: true }) }]);
    drainParked();
    expect(shiftParked).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  // Bug do Samuel: o turno que pergunta é morto pra o card ficar respondível, a
  // sessão fica ociosa e o drainer disparava o item da fila como se fosse a resposta
  // — a pergunta virava passado e sumia sem nunca ter sido respondida.
  it('não drena sessão que parou numa pergunta', () => {
    setAwaiting('s7');
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's7', first: item() }]);
    drainParked();
    expect(shiftParked).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('volta a drenar depois que a pergunta é respondida', () => {
    setAwaiting('s8');
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's8', first: item() }]);
    vi.mocked(shiftParked).mockReturnValue(item());
    drainParked();
    expect(run).not.toHaveBeenCalled();
    startRun({ ws, sessionKey: 's8', prompt: 'resposta do usuário' }); // send manual limpa o latch
    threads.delete('s8');
    drainParked();
    expect(vi.mocked(run).mock.calls.at(-1)![0].prompt).toBe('roda isso');
  });

  // resumeId apontando pra transcript apagado fazia o turno morrer na hora: 3 tentativas
  // e o item ficava segurado sem ninguém entender por quê.
  it('transcript morto vira turno novo em vez de falhar', () => {
    vi.mocked(recordIncident).mockClear();
    vi.mocked(resumableId).mockReturnValueOnce(undefined);
    const it0 = item({ resumeId: 'sess-apagada' });
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's6', first: it0 }]);
    vi.mocked(shiftParked).mockReturnValue(it0);
    drainParked();
    expect(run).toHaveBeenCalledOnce();
    expect(vi.mocked(run).mock.calls[0][0].resumeId).toBeUndefined();
    expect(recordIncident).toHaveBeenCalledWith(expect.objectContaining({ kind: 'parked-resume-morto', sessionKey: 's6' }));
  });

  it('sem token, a fila in-turn vira estacionada em vez de disparar', () => {
    setAwaiting('s4');
    startRun({ ws, sessionKey: 's4', prompt: 'item enfileirado', auto: true });
    startRun({ ws, sessionKey: 's4', prompt: 'resposta do usuário' });
    limited();
    closeLastRun();
    expect(addParked).toHaveBeenCalledWith('s4', expect.objectContaining({ prompt: 'item enfileirado' }));
    expect(run).toHaveBeenCalledOnce();
  });
});

describe('disparo em background de um item da fila', () => {
  const item = (over: Partial<ParkedItem> = {}): ParkedItem => ({ id: 'pk-9', prompt: 'roda isso', at: 1, resumeId: 'sess-pai', ...over });

  beforeEach(() => {
    threads.clear();
    vi.mocked(run).mockClear();
    vi.mocked(quotaHold).mockReturnValue(0);
    vi.mocked(findParked).mockReset();
    vi.mocked(takeParked).mockReset();
    vi.mocked(unshiftParked).mockClear();
    vi.mocked(resumableId).mockImplementation((id?: string) => id);
  });

  it('forka a sessão do chat: roda num id novo e o pai fica intocado', () => {
    vi.mocked(findParked).mockReturnValue(item());
    vi.mocked(takeParked).mockReturnValue(item());
    const r = runParkedInBackground('s1', 'pk-9', 'admin');
    expect('forkId' in r).toBe(true);
    const forkId = (r as { forkId: string }).forkId;
    const call = vi.mocked(run).mock.calls[0][0];
    expect(call.resumeId).toBe('sess-pai');
    expect(call.forkId).toBe(forkId);
    expect(forkId).not.toBe('s1');
    expect(threads.has('s1')).toBe(false);
  });

  // review #597 point 1: um fork disparado pelo canvas (session-reuse.ts
  // "fork") passa attachRecovery=false — se ele morrer sem produzir nada, o
  // prompt (que é de OUTRO card) não pode reaparecer na fila da sessão-mãe.
  it('attachRecovery=false não amarra th.parked/parkedFrom (default true amarra)', () => {
    vi.mocked(findParked).mockReturnValue(item());
    vi.mocked(takeParked).mockReturnValue(item());
    const r1 = runParkedInBackground('s1', 'pk-9', 'admin', undefined, false);
    const forkId1 = (r1 as { forkId: string }).forkId;
    expect(threads.get(forkId1)?.parked).toBeUndefined();
    expect(threads.get(forkId1)?.parkedFrom).toBeUndefined();

    vi.mocked(findParked).mockReturnValue(item());
    vi.mocked(takeParked).mockReturnValue(item());
    const r2 = runParkedInBackground('s1', 'pk-9', 'admin');
    const forkId2 = (r2 as { forkId: string }).forkId;
    expect(threads.get(forkId2)?.parked).toEqual(item());
    expect(threads.get(forkId2)?.parkedFrom).toBe('s1');
  });

  it('o modelo escolhido na hora vence o que estava enfileirado', () => {
    vi.mocked(findParked).mockReturnValue(item({ model: 'opus' }));
    vi.mocked(takeParked).mockReturnValue(item({ model: 'opus' }));
    runParkedInBackground('s1', 'pk-9', 'admin', 'haiku');
    expect(vi.mocked(run).mock.calls[0][0].model).toBe('haiku');
  });

  // Um fork nascido de uma entrega de fluxo do canvas (server/canvas/flows.ts
  // deliverToCard, reuse 'continue'/'fork') carrega a profundidade da cadeia —
  // sem isto, um crash-resume DESTE fork reseta o hop pra 0 e MAX_HOPS nunca
  // barra a cadeia que deveria.
  it('flowHop chega no Thread do fork quando informado, e fica undefined quando não (clique manual)', () => {
    vi.mocked(findParked).mockReturnValue(item());
    vi.mocked(takeParked).mockReturnValue(item());
    const r1 = runParkedInBackground('s1', 'pk-9', 'admin', undefined, false, true, 3);
    const forkId1 = (r1 as { forkId: string }).forkId;
    expect(threads.get(forkId1)?.flowHop).toBe(3);

    vi.mocked(findParked).mockReturnValue(item());
    vi.mocked(takeParked).mockReturnValue(item());
    const r2 = runParkedInBackground('s1', 'pk-9', 'admin');
    const forkId2 = (r2 as { forkId: string }).forkId;
    expect(threads.get(forkId2)?.flowHop).toBeUndefined();
  });

  // Devolver depois de recusar contaria uma tentativa falha que nunca houve, e no
  // teto o item ficaria segurado por engano.
  it('recusa ANTES de tirar da fila: sem quota, sem item, sem contexto', () => {
    vi.mocked(quotaHold).mockReturnValue(Date.now() + 60_000);
    expect(runParkedInBackground('s1', 'pk-9', 'admin')).toEqual({ reject: 'sem-quota' });
    vi.mocked(quotaHold).mockReturnValue(0);

    vi.mocked(findParked).mockReturnValue(null);
    expect(runParkedInBackground('s1', 'pk-9', 'admin')).toEqual({ reject: 'sem-item' });

    vi.mocked(findParked).mockReturnValue(item({ resumeId: undefined }));
    vi.mocked(resumableId).mockReturnValue(undefined);
    expect(runParkedInBackground('s1', 'pk-9', 'admin')).toEqual({ reject: 'sem-contexto' });

    expect(takeParked).not.toHaveBeenCalled();
    expect(unshiftParked).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  // review #597 point 2: um fork de card do canvas passa enforceHardCtxCap=true
  // — ao contrário do clique manual "rodar em paralelo" (intenção explícita
  // do usuário, nunca barrado pelo teto), o alvo de um fork pode ter sido
  // escolhido pelo DEFAULT do ranking, sem o usuário ter olhado o tamanho.
  it('enforceHardCtxCap barra sessão-mãe grande demais; sem a flag (default) segue igual antes', () => {
    vi.mocked(findParked).mockReturnValue(item());
    usageRow.value = { ctxTokens: CTX_HARD, ts: Date.now(), model: 'claude-opus-5' };

    expect(runParkedInBackground('s1', 'pk-9', 'admin', undefined, true, true)).toEqual({ reject: 'ctx-grande' });
    expect(takeParked).not.toHaveBeenCalled();

    vi.mocked(takeParked).mockReturnValue(item());
    const r = runParkedInBackground('s1', 'pk-9', 'admin');
    expect('forkId' in r).toBe(true);

    usageRow.value = null;
  });

  it('takeParked negado (item de admin, pedido de student) não roda nada', () => {
    vi.mocked(findParked).mockReturnValue(item({ role: 'admin' }));
    vi.mocked(takeParked).mockReturnValue(null);
    expect(runParkedInBackground('s1', 'pk-9', 'student')).toEqual({ reject: 'sem-item' });
    expect(run).not.toHaveBeenCalled();
  });
});

// Furar a fila (estilo Cursor): o item escolhido vira o próximo turno e o que está
// rodando agora morre pra dar lugar a ele.
describe('disparo imediato de um item da fila (furar a fila)', () => {
  const ws = {} as WebSocket;
  const item = (over: Partial<ParkedItem> = {}): ParkedItem => ({ id: 'pk-9', prompt: 'esse aqui primeiro', at: 1, ...over });
  const lastKill = () => vi.mocked(run).mock.results.at(-1)!.value.kill;
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    vi.mocked(run).mockClear();
    vi.mocked(quotaHold).mockReturnValue(0);
    vi.mocked(isQueuePaused).mockReturnValue(false);
    vi.mocked(findParked).mockReturnValue(item());
    vi.mocked(promoteParked).mockReturnValue(true);
    vi.mocked(takeParked).mockReset();
    vi.mocked(parkedHeads).mockReturnValue([]);
    vi.mocked(shiftParked).mockReset();
    startParkedDrainer(3_600_000);
  });

  // Mata o turno e sobe o item NA HORA. Antes só promovia e contava com o dreno do
  // onClose — que é no-op fora do processo do agente (drainerEnabled), e o Deck roda
  // index e agente sobre o mesmo parked.json: pelo index o clique não subia nada.
  it('mata o turno em andamento e sobe o item no lugar, sem depender do dreno', () => {
    vi.mocked(takeParked).mockReturnValue(item());
    startRun({ ws, sessionKey: 'now1', prompt: 'o que estava rodando' });
    const kill = lastKill();
    expect(runParkedNow('now1', 'pk-9', 'admin')).toEqual({ ok: true });
    expect(takeParked).toHaveBeenCalledWith('now1', 'pk-9', 'admin');
    expect(kill).toHaveBeenCalled();
    expect(vi.mocked(run).mock.calls.at(-1)![0].prompt).toBe('esse aqui primeiro');
    // Amarrado ao turno: se ele morrer sem consumir o prompt, o onClose devolve.
    expect(threads.get('now1')?.parked?.id).toBe('pk-9');
  });

  // O item sai do disco ANTES do kill: sem isso o dreno do onClose competiria pelo
  // mesmo item e os dois caminhos tentariam subi-lo.
  it('recusa sem matar o turno quando o item some entre a espiada e a retirada', () => {
    vi.mocked(takeParked).mockReturnValue(null);
    startRun({ ws, sessionKey: 'now6', prompt: 'o que estava rodando' });
    const kill = lastKill();
    expect(runParkedNow('now6', 'pk-9', 'admin')).toEqual({ reject: 'sem-item' });
    expect(kill).not.toHaveBeenCalled();
  });

  it('sessão ociosa: não há turno pra matar e o item dispara na hora', () => {
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 'now2', first: item() }]);
    vi.mocked(shiftParked).mockReturnValue(item());
    expect(runParkedNow('now2', 'pk-9')).toEqual({ ok: true });
    expect(run).toHaveBeenCalledOnce();
    expect(vi.mocked(run).mock.calls[0][0].prompt).toBe('esse aqui primeiro');
  });

  // O turno em andamento é trabalho real: recusar DEPOIS de matá-lo custaria o turno
  // do usuário sem nada subir no lugar (o drainer ignora fila pausada e item segurado).
  it('recusa ANTES de matar o turno: pausada, sem quota, segurado, fantasma, pergunta pendente', () => {
    const cases: [() => void, string][] = [
      [() => vi.mocked(isQueuePaused).mockReturnValue(true), 'fila-pausada'],
      [() => vi.mocked(quotaHold).mockReturnValue(Date.now() + 60_000), 'sem-quota'],
      [() => vi.mocked(findParked).mockReturnValue(item({ held: true })), 'segurado'],
      [() => vi.mocked(findParked).mockReturnValue(null), 'sem-item'],
    ];
    for (const [arm, reject] of cases) {
      threads.clear();
      clearAllAwaiting();
      vi.mocked(run).mockClear();
      vi.mocked(isQueuePaused).mockReturnValue(false);
      vi.mocked(quotaHold).mockReturnValue(0);
      vi.mocked(findParked).mockReturnValue(item());
      vi.mocked(promoteParked).mockClear();
      arm();
      startRun({ ws, sessionKey: 'now3', prompt: 'o que estava rodando' });
      const kill = lastKill();
      expect(runParkedNow('now3', 'pk-9')).toEqual({ reject });
      expect(kill).not.toHaveBeenCalled();
      expect(promoteParked).not.toHaveBeenCalled();
    }
  });

  // O translate mata o run pra o card de escolha ficar respondível, então a sessão
  // fica ociosa com o latch ligado. O drainer pula sessão nesse estado: promover
  // deixaria o item no topo sem nada subir. Abrir mão do card é o queue-force.
  it('turno esperando resposta: recusa em vez de promover pra ninguém drenar', () => {
    setAwaiting('now5');
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 'now5', first: item() }]);
    vi.mocked(shiftParked).mockReturnValue(item());
    expect(runParkedNow('now5', 'pk-9')).toEqual({ reject: 'aguardando-resposta' });
    expect(promoteParked).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  // promoteParked lê o disco: entre o findParked e ele, outro aparelho pode ter
  // cancelado o item. Matar o turno aí deixaria a sessão vazia.
  it('item some entre o espiar e o promover: não mata o turno', () => {
    startRun({ ws, sessionKey: 'now4', prompt: 'o que estava rodando' });
    const kill = lastKill();
    vi.mocked(promoteParked).mockReturnValue(false);
    expect(runParkedNow('now4', 'pk-9')).toEqual({ reject: 'sem-item' });
    expect(kill).not.toHaveBeenCalled();
  });
});

// Gate de contexto (ws/ctx-guard.ts). Incidente de 04/09/2026: quatro sessões de
// 631k–780k tokens receberam prompt com cache frio em 3min29s e a janela de 5h foi
// de ~20% a 100%. Nenhuma guarda existente via isso — o quotaHold só age em 100%.
describe('gate de contexto', () => {
  const ws = { send: vi.fn() } as unknown as WebSocket;
  const item = (over: Partial<ParkedItem> = {}): ParkedItem => ({ id: 'pk-1', prompt: 'roda isso', at: 1, ...over });
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
  const setCtx = (ctxTokens: number, ageMs = 3 * 60 * 60_000) => {
    usageRow.value = { ctxTokens, ts: Date.now() - ageMs, model: 'claude-opus-5' };
  };

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    usageRow.value = null;
    resetCooldownState();
    resetColdInflight();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(recordIncident).mockClear();
    vi.mocked(quotaHold).mockReturnValue(0);
    vi.mocked(isQueuePaused).mockReturnValue(false);
    vi.mocked(parkedHeads).mockReturnValue([]);
    vi.mocked(shiftParked).mockReset();
    vi.mocked(unshiftParked).mockClear();
    vi.mocked(addParked).mockClear();
    startParkedDrainer(3_600_000);
  });

  // O teto duro é uma trava contra a MÁQUINA se retomar sozinha, não contra o
  // Samuel: barrar o composer deixava a sessão sem saída além de migrar.
  it('recusa o turno automático numa sessão acima do teto duro, sem spawnar', () => {
    setCtx(779_566);
    startRun({ ws: null, sessionKey: 'gg', prompt: 'dreno da fila', resumeId: 'sess-gigante' });
    expect(run).not.toHaveBeenCalled();
    expect(threads.has('gg')).toBe(false);
    expect(recordIncident).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ctx-hard' }));
  });

  it('o flush automático do cliente também é barrado no teto duro', () => {
    setCtx(779_566);
    startRun({ ws, sessionKey: 'gg', prompt: 'auto', resumeId: 'sess-gigante', auto: true });
    expect(run).not.toHaveBeenCalled();
  });

  it('o envio MANUAL passa acima do teto duro (avisa, não tranca)', () => {
    setCtx(779_566);
    startRun({ ws, sessionKey: 'gg', prompt: 'quero continuar mesmo assim', resumeId: 'sess-gigante', msgId: 'm1' });
    expect(run).toHaveBeenCalledOnce();
    expect(threads.has('gg')).toBe(true);
    expect(recordIncident).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'ctx-hard' }));
  });

  it('a recusa devolve o texto e o msgId pro cliente (a bolha otimista não fica órfã)', () => {
    setCtx(779_566);
    startRun({ ws, sessionKey: 'gg', prompt: 'meu prompt', resumeId: 'sess-b', msgId: 'm1', auto: true });
    expect(send).toHaveBeenCalledWith(ws, expect.objectContaining({
      t: 'send-reject', reason: 'ctx-hard', text: 'meu prompt', msgId: 'm1',
    }));
  });

  // Bug de 11/09/2026: a 99% o composer ainda envia (pausa só em 99,5) e o gate
  // recusava com "não cabe no que sobrou" — o banner "O turno falhou" aparecia e a
  // fila deixada pro próximo batch nunca chegava ao parked.json.
  it('envio que não cabe na janela vai pra fila em vez de falhar', () => {
    vi.mocked(send).mockClear();
    vi.mocked(getLastPlanUsage).mockReturnValue({ fiveHour: 99 } as never);
    setCtx(50_000);
    startRun({ ws, sessionKey: 'fim', prompt: 'roda no próximo batch', resumeId: 'sess-fim', msgId: 'm9', model: 'claude-opus-5' });
    expect(run).not.toHaveBeenCalled();
    expect(addParked).toHaveBeenCalledWith('fim', expect.objectContaining({ prompt: 'roda no próximo batch', resumeId: 'sess-fim', model: 'claude-opus-5' }));
    expect(send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'send-parked', msgId: 'm9' }));
    expect(send).not.toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'send-reject' }));
    vi.mocked(getLastPlanUsage).mockReturnValue(null);
  });

  it('item da fila in-turn que não cabe na janela também vai pra fila', () => {
    startRun({ ws, sessionKey: 'dr', prompt: 'turno atual', resumeId: 'sess-dr' });
    vi.mocked(classify).mockResolvedValueOnce({ action: 'wait', reason: '' } as never);
    return routeSend({ ws, sessionKey: 'dr', prompt: 'depois deste', resumeId: 'sess-dr' }).then(() => {
      vi.mocked(getLastPlanUsage).mockReturnValue({ fiveHour: 99.2 } as never);
      setCtx(50_000);
      closeLastRun();
      expect(addParked).toHaveBeenCalledWith('dr', expect.objectContaining({ prompt: 'depois deste' }));
      expect(run).toHaveBeenCalledOnce();
      vi.mocked(getLastPlanUsage).mockReturnValue(null);
    });
  });

  it('se a fila recusar o item, volta pro composer como antes', () => {
    vi.mocked(getLastPlanUsage).mockReturnValue({ fiveHour: 99 } as never);
    vi.mocked(addParked).mockReturnValueOnce({ reject: 'cheia' } as never);
    setCtx(50_000);
    startRun({ ws, sessionKey: 'fim', prompt: 'x', resumeId: 'sess-fim', msgId: 'm9' });
    expect(send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'send-reject', reason: 'quota-insufficient', text: 'x' }));
    vi.mocked(getLastPlanUsage).mockReturnValue(null);
  });

  it('sessão nova e sessão pequena passam', () => {
    startRun({ ws, sessionKey: 'nova', prompt: 'oi' });
    expect(run).toHaveBeenCalledOnce();
    setCtx(50_000);
    startRun({ ws, sessionKey: 'peq', prompt: 'oi', resumeId: 'sess-peq' });
    expect(run).toHaveBeenCalledTimes(2);
  });

  // A saída barata do 'hard' é o botão Migrar (frame `session-handoff` ->
  // server/handoff.ts), que destila pela API e NÃO passa pelo startRun.
  it('a sessão nova que nasce depois da migração passa normalmente', () => {
    setCtx(779_566);
    startRun({ ws, sessionKey: 'gg', prompt: 'continuando o trabalho pelo contexto migrado' });
    expect(run).toHaveBeenCalledOnce();
  });

  it('segura o segundo cold-start grande e solta no fechamento do primeiro', () => {
    setCtx(120_000);
    startRun({ ws, sessionKey: 'a', prompt: 'primeiro', resumeId: 'sess-a' });
    expect(run).toHaveBeenCalledOnce();
    startRun({ ws, sessionKey: 'b', prompt: 'segundo', resumeId: 'sess-b', msgId: 'm2' });
    expect(run).toHaveBeenCalledOnce(); // segurado: cold-busy vai pra fila
    expect(send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'send-parked', msgId: 'm2' }));
    closeLastRun();
    startRun({ ws, sessionKey: 'b', prompt: 'segundo', resumeId: 'sess-b' });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('cache quente não disputa o semáforo (é o caso barato)', () => {
    setCtx(700_000, 30_000);
    acquireCold('outra');
    setCtx(120_000, 30_000);
    startRun({ ws, sessionKey: 'quente', prompt: 'oi', resumeId: 'sess-q' });
    expect(run).toHaveBeenCalledOnce();
  });

  // Entre o teto brando e o duro o turno PASSA: quem avisa é o SaturationBanner do
  // cliente (80% da janela). O servidor só barra no duro — travar antes tiraria do
  // Samuel a chance de terminar o que estava fazendo.
  it('deixa passar entre o teto brando e o duro', () => {
    setCtx(170_000);
    startRun({ ws, sessionKey: 'meio', prompt: 'termina isso', resumeId: 'sess-meio' });
    expect(run).toHaveBeenCalledOnce();
  });

  it('não retoma sozinho uma sessão acima do teto (o auto-resume de 04/09 às 05:50)', () => {
    startRun({ ws, sessionKey: 'orfa', prompt: 'trabalho', resumeId: 'sess-gigante' });
    threads.get('orfa')!.sessionId = 'sess-gigante';
    setCtx(631_342);
    closeLastRun(); // morte silenciosa: sem endReason e sem stop
    expect(run).toHaveBeenCalledOnce(); // só o turno original; nenhuma retomada
    expect(recordIncident).toHaveBeenCalledWith(expect.objectContaining({ kind: 'resume-ctx-cap' }));
  });

  // Regra do Samuel: item na fila é prompt que ELE escreveu, só que pra rodar
  // depois. O teto duro barra o que a máquina dispara sozinha (auto-resume, cron),
  // não isso — antes a fila virava um "erro, tente de novo" a cada tick do dreno.
  it('o drainer dispara a fila mesmo acima do teto duro de contexto', () => {
    setCtx(779_566);
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's1', first: item({ resumeId: 'sess-gigante' }) }]);
    vi.mocked(shiftParked).mockReturnValue(item({ resumeId: 'sess-gigante' }));
    drainParked();
    expect(run).toHaveBeenCalledOnce();
    expect(unshiftParked).not.toHaveBeenCalled();
  });

  it('o drainer deixa o item na fila, sem erro, quando outro cold-start grande está em voo', () => {
    setCtx(120_000);
    acquireCold('outra-sessao');
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's1', first: item({ resumeId: 'sess-fria' }) }]);
    drainParked();
    expect(shiftParked).not.toHaveBeenCalled();
    expect(unshiftParked).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === 'error')).toEqual([]);
  });

  it('o drainer espera o cooldown depois que a janela vira', () => {
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's1', first: item() }]);
    vi.mocked(shiftParked).mockReturnValue(item());
    vi.mocked(quotaHold).mockReturnValue(Date.now() + 60_000);
    drainParked();                              // segurado: arma a transição
    vi.mocked(quotaHold).mockReturnValue(0);
    drainParked();                              // janela virou: ainda no cooldown
    expect(run).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now() + COOLDOWN_AFTER_RESET_MS + 1);
    drainParked();
    expect(run).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  // Mesmo princípio do dreno: clicar "rodar em background" num item da fila é
  // intenção explícita. Só quota e cold-busy recusam.
  it('o fork em background roda acima do teto duro (a fila é pedido do usuário)', () => {
    setCtx(779_566);
    vi.mocked(findParked).mockReturnValue(item({ resumeId: 'sess-gigante' }));
    vi.mocked(takeParked).mockReturnValue(item({ resumeId: 'sess-gigante' }));
    expect(runParkedInBackground('s1', 'pk-1')).toHaveProperty('forkId');
    expect(run).toHaveBeenCalledOnce();
  });
});

const HEALTHY_MEM = { availMb: 100_000, swapFreeMb: 4000, swapTotalMb: 4096 };
const STARVED_MEM = { availMb: 100, swapFreeMb: 50, swapTotalMb: 4096 };

// D1 — o exit code/sinal sozinho não basta: só vira 'oom-kill' quando a máquina
// também está apertada no instante do fechamento. Postmortem 17/09: exit 143 sem
// este segundo sinal já virava "claude saiu (143)" pra crashes genuínos também.
describe('D1 — morte silenciosa classificada como OOM kill', () => {
  const ws = {} as WebSocket;
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
  const errors = () => vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === 'error');

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(recordIncident).mockClear();
    vi.mocked(getLastPlanUsage).mockReturnValue(null);
    usageRow.value = null;
    resetCooldownState();
    resetColdInflight();
    memInfoMock.value = HEALTHY_MEM;
  });

  it('exit 143 + memória baixa vira incidente oom-kill com mensagem dedicada', () => {
    startRun({ ws, sessionKey: 'oom1', prompt: 'trabalho', resumeId: 'sess-oom1' });
    threads.get('oom1')!.lastExitCode = 143;
    memInfoMock.value = STARVED_MEM;
    closeLastRun();
    expect(errors()[0]).toMatchObject({ message: expect.stringContaining('ficou sem memória') });
    expect(vi.mocked(recordIncident)).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'oom-kill', sessionKey: 'oom1', detail: expect.stringContaining('availMb=100'),
    }));
  });

  it('exit 137 (SIGKILL) + swap quase zerado também vira oom-kill', () => {
    startRun({ ws, sessionKey: 'oom2', prompt: 'trabalho', resumeId: 'sess-oom2' });
    threads.get('oom2')!.lastExitCode = 137;
    memInfoMock.value = { availMb: 2000, swapFreeMb: 20, swapTotalMb: 4096 };
    closeLastRun();
    expect(errors()[0]).toMatchObject({ message: expect.stringContaining('ficou sem memória') });
  });

  it('exit code sem relação com OOM continua como silent-death genérico', () => {
    startRun({ ws, sessionKey: 'oom3', prompt: 'trabalho', resumeId: 'sess-oom3' });
    threads.get('oom3')!.lastExitCode = 1;
    memInfoMock.value = STARVED_MEM;
    closeLastRun();
    expect(errors()[0]).toMatchObject({ message: expect.stringContaining('caiu antes de terminar') });
    expect(vi.mocked(recordIncident)).toHaveBeenCalledWith(expect.objectContaining({ kind: 'silent-death' }));
  });

  it('exit 143 numa máquina saudável é sinal EXTERNO, não oom-kill nem crash', () => {
    resetExternalKills();
    startRun({ ws, sessionKey: 'oom4', prompt: 'trabalho', resumeId: 'sess-oom4' });
    threads.get('oom4')!.lastExitCode = 143;
    memInfoMock.value = HEALTHY_MEM;
    closeLastRun();
    expect(errors()[0]).toMatchObject({ message: expect.stringContaining('fora do Deck') });
    expect(vi.mocked(recordIncident)).toHaveBeenCalledWith(expect.objectContaining({ kind: 'external-kill' }));
  });
});

// D2 — a retomada automática não pode subir com a memória ainda estourada (era o
// resume-exhausted em 5-10s do postmortem). Espera com backoff sem gastar o cap.
describe('D2 — autoResume espera a memória antes de retomar', () => {
  const ws = {} as WebSocket;
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
  const errors = () => vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === 'error');

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(getLastPlanUsage).mockReturnValue(null);
    usageRow.value = null;
    resetCooldownState();
    resetColdInflight();
    memInfoMock.value = HEALTHY_MEM;
    vi.useFakeTimers();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('não dispara --resume enquanto a memória está low; sobe assim que ela volta, sem gastar o cap', () => {
    memInfoMock.value = STARVED_MEM;
    startRun({ ws, sessionKey: 'bk1', prompt: 'trabalho', resumeId: 'sess-bk1' });
    closeLastRun();
    expect(run).toHaveBeenCalledOnce(); // ainda não retomou

    vi.advanceTimersByTime(30_000); // 1º passo do backoff: memória continua low
    expect(run).toHaveBeenCalledOnce();

    memInfoMock.value = HEALTHY_MEM; // memória volta antes do 2º passo
    vi.advanceTimersByTime(60_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.mocked(run).mock.calls[1][0].prompt).toContain('Continue exatamente de onde parou');
  });

  it('a retomada adiada ainda respeita AUTO_RESUME_CAP depois de rodar', () => {
    memInfoMock.value = STARVED_MEM;
    startRun({ ws, sessionKey: 'bk2', prompt: 'trabalho', resumeId: 'sess-bk2' });
    closeLastRun();
    memInfoMock.value = HEALTHY_MEM;
    vi.advanceTimersByTime(30_000); // memória já ok no 1º passo -> retoma de verdade
    expect(run).toHaveBeenCalledTimes(2);

    closeLastRun(); // a retomada também morre — cap (1) já foi gasto
    expect(run).toHaveBeenCalledTimes(2);
    const offer = vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === 'resume-offer').at(-1);
    expect(offer).toMatchObject({ sessionKey: 'bk2', reason: 'exhausted' });
  });

  it('reavalia threads.has/isAwaiting no disparo do timer, não no agendamento', () => {
    memInfoMock.value = STARVED_MEM;
    startRun({ ws, sessionKey: 'bk3', prompt: 'trabalho', resumeId: 'sess-bk3' });
    closeLastRun();
    memInfoMock.value = HEALTHY_MEM;
    // Um turno novo sobe na sessão ANTES do backoff disparar — a retomada adiada
    // não pode atropelá-lo quando o timer finalmente reavaliar.
    startRun({ ws, sessionKey: 'bk3', prompt: 'novo pedido', resumeId: 'sess-bk3' });
    const callsBefore = vi.mocked(run).mock.calls.length;
    vi.advanceTimersByTime(30_000);
    expect(vi.mocked(run).mock.calls.length).toBe(callsBefore); // nada novo disparou por cima
  });
});

// D2 — o dreno da fila estacionada não pode subir turno novo com a memória
// apertada: segura em silêncio (sem consumir tentativa) até o próximo tick.
describe('D2 — drainParked segura durante memória apertada', () => {
  const item = (over: Partial<ParkedItem> = {}): ParkedItem => ({ id: 'pk-mem', prompt: 'roda isso', at: 1, ...over });

  beforeEach(() => {
    threads.clear();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(quotaHold).mockReturnValue(0);
    vi.mocked(isQueuePaused).mockReturnValue(false);
    vi.mocked(parkedHeads).mockReturnValue([]);
    vi.mocked(shiftParked).mockReset();
    vi.mocked(unshiftParked).mockClear();
    usageRow.value = null;
    resetCooldownState();
    resetColdInflight();
    memInfoMock.value = HEALTHY_MEM;
    startParkedDrainer(3_600_000);
  });

  it('não dispara nem consome o item da fila quando a memória está low', () => {
    memInfoMock.value = STARVED_MEM;
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's1', first: item() }]);
    drainParked();
    expect(run).not.toHaveBeenCalled();
    expect(vi.mocked(shiftParked)).not.toHaveBeenCalled();
    expect(vi.mocked(unshiftParked)).not.toHaveBeenCalled(); // não conta tentativa
  });

  it('volta a disparar assim que a memória normaliza', () => {
    memInfoMock.value = STARVED_MEM;
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's1', first: item() }]);
    drainParked();
    expect(run).not.toHaveBeenCalled();

    memInfoMock.value = HEALTHY_MEM;
    vi.mocked(shiftParked).mockReturnValue(item());
    drainParked();
    expect(run).toHaveBeenCalledOnce();
  });
});

// D5 — teto de concorrência dinâmico pela memória livre, avaliado na admissão.
describe('D5 — admissão de turno sensível à memória', () => {
  const ws = {} as WebSocket;

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    vi.mocked(run).mockClear();
    vi.mocked(send).mockClear();
    vi.mocked(getLastPlanUsage).mockReturnValue(null);
    usageRow.value = null;
    resetCooldownState();
    resetColdInflight();
    memInfoMock.value = HEALTHY_MEM;
  });

  it('recusa com mensagem de memória quando o teto efetivo cai abaixo das sessões vivas', () => {
    startRun({ ws, sessionKey: 'm1', prompt: 'a', resumeId: 'sess-m1' });
    expect(threads.has('m1')).toBe(true);
    // memoryRunCap(700, 12, 1) = 1 viva + floor((700-400)/350) = 0 extra: com m1 já viva,
    // a sessão nova (não-replacing) não cabe.
    memInfoMock.value = { availMb: 700, swapFreeMb: 4000, swapTotalMb: 4096 };
    startRun({ ws, sessionKey: 'm2', prompt: 'b', resumeId: 'sess-m2' });
    expect(threads.has('m2')).toBe(false);
    expect(vi.mocked(send)).toHaveBeenCalledWith(ws, expect.objectContaining({
      t: 'error', sessionKey: 'm2', message: expect.stringContaining('pouca memória'),
    }));
  });

  it('substituir a própria sessão (replacing) é sempre admitido mesmo com memória mínima', () => {
    startRun({ ws, sessionKey: 'm3', prompt: 'a', resumeId: 'sess-m3' });
    memInfoMock.value = { availMb: 0, swapFreeMb: 0, swapTotalMb: 4096 };
    startRun({ ws, sessionKey: 'm3', prompt: 'b', resumeId: 'sess-m3' });
    expect(threads.has('m3')).toBe(true);
    expect(vi.mocked(run)).toHaveBeenCalledTimes(2);
  });

  it('memória farta usa o teto normal de CONFIG.maxConcurrentRuns', () => {
    memInfoMock.value = HEALTHY_MEM;
    startRun({ ws, sessionKey: 'm4', prompt: 'a', resumeId: 'sess-m4' });
    expect(threads.has('m4')).toBe(true);
    expect(vi.mocked(send)).not.toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'error' }));
  });
});


// D6 — SIGTERM EXTERNO (deploy, varredura do earlyoom, pkill) não é crash: o
// processo não quebrou, alguém o matou, e quem matou costuma matar todos os
// irmãos na mesma rajada. Retomar na hora entrega o --resume de volta à mesma
// condição — foi a cadeia run-error "claude saiu (143)" -> silent-death ->
// resume-exhausted de 17/09, com duas sessões mortas no mesmo minuto.
describe('D6 — retomada após sinal externo', () => {
  const ws = {} as WebSocket;
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
  const msgs = (t: string) => vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === t);
  const killedExternally = (key: string, sessionId: string) => {
    startRun({ ws, sessionKey: key, prompt: 'trabalho', resumeId: sessionId });
    threads.get(key)!.lastExitCode = 143;
    closeLastRun();
  };

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(recordIncident).mockClear();
    vi.mocked(quotaHold).mockReturnValue(0);
    vi.mocked(getLastPlanUsage).mockReturnValue(null);
    usageRow.value = null;
    resetCooldownState();
    resetColdInflight();
    resetExternalKills();
    vi.mocked(parkedHeads).mockReturnValue([]); // describes anteriores deixam a fila carregada
    vi.mocked(isQueuePaused).mockReturnValue(false);
    memInfoMock.value = HEALTHY_MEM;
    vi.useFakeTimers();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('não re-dispara na hora e diz que vai esperar a máquina assentar', () => {
    killedExternally('ex1', 'sess-ex1');
    expect(run).toHaveBeenCalledOnce();
    expect(msgs('error').at(-1)).toMatchObject({ message: expect.stringContaining('assentar') });
    expect(vi.mocked(recordIncident)).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'external-kill', sessionKey: 'ex1', detail: expect.stringContaining('exit=143'),
    }));
  });

  it('retoma UMA vez depois que a rajada de kills para', () => {
    killedExternally('ex2', 'sess-ex2');
    vi.advanceTimersByTime(EXTERNAL_QUIET_MS + EXTERNAL_POLL_MS);
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.mocked(run).mock.calls[1][0]).toMatchObject({ resumeId: 'sess-ex2' });
    expect(vi.mocked(run).mock.calls[1][0].prompt).toContain('Continue exatamente de onde parou');
  });

  it('um irmão morrendo no meio da espera empurra a janela em vez de correr com o deploy', () => {
    killedExternally('ex3', 'sess-ex3');
    vi.advanceTimersByTime(30_000);
    noteExternalKill(); // outra sessão cai na 2ª leva do mesmo deploy
    vi.advanceTimersByTime(30_000);
    expect(run).toHaveBeenCalledOnce(); // 60s após a MORTE, mas só 30s de silêncio
    vi.advanceTimersByTime(EXTERNAL_QUIET_MS);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a espera não gasta o teto de retomada automática', () => {
    killedExternally('ex4', 'sess-ex4');
    vi.advanceTimersByTime(EXTERNAL_QUIET_MS + EXTERNAL_POLL_MS);
    expect(run).toHaveBeenCalledTimes(2); // a única tentativa do cap foi usada aqui
    threads.get('ex4')!.lastExitCode = 1;
    closeLastRun();
    expect(run).toHaveBeenCalledTimes(2);
    expect(hasResumeOffer('ex4')).toBe(true);
  });

  it('desiste e OFERECE retomada quando os kills não param', () => {
    killedExternally('ex5', 'sess-ex5');
    for (let i = 0; i < 45 && vi.mocked(run).mock.calls.length === 1 && !hasResumeOffer('ex5'); i++) {
      noteExternalKill();
      vi.advanceTimersByTime(EXTERNAL_POLL_MS);
    }
    expect(run).toHaveBeenCalledOnce(); // nunca re-disparou em cima da rajada
    expect(msgs('resume-offer').at(-1)).toMatchObject({ sessionKey: 'ex5', reason: 'external-kill', sessionId: 'sess-ex5' });
    expect(vi.mocked(recordIncident)).toHaveBeenCalledWith(expect.objectContaining({ kind: 'external-kill-give-up' }));
  });

  it('turno novo na sessão cancela a espera em vez de atropelá-lo', () => {
    killedExternally('ex6', 'sess-ex6');
    startRun({ ws, sessionKey: 'ex6', prompt: 'outro pedido', resumeId: 'sess-ex6' });
    const before = vi.mocked(run).mock.calls.length;
    vi.advanceTimersByTime(EXTERNAL_QUIET_MS + EXTERNAL_POLL_MS);
    expect(vi.mocked(run).mock.calls.length).toBe(before);
  });
});

// Nenhum turno pode sumir em silêncio: toda desistência de retomada vira oferta
// com motivo, e o clique do usuário vale um --resume de verdade.
describe('oferta de retomada', () => {
  const ws = {} as WebSocket;
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
  const msgs = (t: string) => vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === t);

  beforeEach(() => {
    threads.clear();
    clearAllAwaiting();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(recordIncident).mockClear();
    vi.mocked(quotaHold).mockReturnValue(0);
    vi.mocked(getLastPlanUsage).mockReturnValue(null);
    usageRow.value = null;
    resetCooldownState();
    resetColdInflight();
    resetExternalKills();
    vi.mocked(parkedHeads).mockReturnValue([]); // describes anteriores deixam a fila carregada
    vi.mocked(isQueuePaused).mockReturnValue(false);
    memInfoMock.value = HEALTHY_MEM;
  });

  it('sem janela de token não retoma, mas deixa a oferta com o motivo', () => {
    startRun({ ws, sessionKey: 'of1', prompt: 'trabalho', resumeId: 'sess-of1' });
    vi.mocked(quotaHold).mockReturnValue(1);
    closeLastRun();
    expect(run).toHaveBeenCalledOnce();
    expect(msgs('resume-offer').at(-1)).toMatchObject({ sessionKey: 'of1', reason: 'quota' });
  });

  it('teto de retomada esgotado vira oferta em vez de beco sem saída', () => {
    startRun({ ws, sessionKey: 'of2', prompt: 'trabalho', resumeId: 'sess-of2' });
    closeLastRun();          // 1ª morte -> retoma sozinho (crash genérico)
    expect(run).toHaveBeenCalledTimes(2);
    closeLastRun();          // a retomada também cai -> cap esgotado
    expect(msgs('resume-offer').at(-1)).toMatchObject({ sessionKey: 'of2', reason: 'exhausted' });
  });

  it('o clique do usuário retoma com a config do turno morto', () => {
    startRun({ ws, sessionKey: 'of3', prompt: 'trabalho', resumeId: 'sess-of3', model: 'opus', effort: 'high', mode: 'plan' });
    vi.mocked(quotaHold).mockReturnValue(1);
    closeLastRun();
    vi.mocked(quotaHold).mockReturnValue(0);
    expect(acceptResumeOffer('of3')).toBe(true);
    const resumed = vi.mocked(run).mock.calls.at(-1)![0];
    expect(resumed).toMatchObject({ resumeId: 'sess-of3', model: 'opus', effort: 'high', mode: 'plan' });
    expect(resumed.prompt).toContain('Continue exatamente de onde parou');
    expect(acceptResumeOffer('of3')).toBe(false); // oferta é de uso único
  });

  it('a oferta some quando um turno novo pega a sessão', () => {
    startRun({ ws, sessionKey: 'of4', prompt: 'trabalho', resumeId: 'sess-of4' });
    vi.mocked(quotaHold).mockReturnValue(1);
    closeLastRun();
    expect(hasResumeOffer('of4')).toBe(true);
    vi.mocked(quotaHold).mockReturnValue(0);
    startRun({ ws, sessionKey: 'of4', prompt: 'outro pedido', resumeId: 'sess-of4' });
    expect(hasResumeOffer('of4')).toBe(false);
  });
});

describe('startRun / routeSend — twin-process guard on the Orchestrator pane', () => {
  const ws = {} as WebSocket;
  const orch = { name: 'orch', sessionId: 'orch-sid', tmux: 'cockpit-cv-abc' };

  beforeEach(() => {
    threads.clear();
    vi.mocked(run).mockClear();
    vi.mocked(readOrchestratorSync).mockReset().mockReturnValue(undefined);
    vi.mocked(isTmuxAliveSync).mockReset().mockReturnValue(false);
    vi.mocked(hasTerm).mockReset().mockReturnValue(false);
    vi.mocked(openTerm).mockReset().mockReturnValue(true);
    vi.mocked(inputTerm).mockReset();
    vi.mocked(broadcast).mockClear();
  });

  it('never delivers into the pane for a non-admin role', () => {
    vi.mocked(readOrchestratorSync).mockReturnValue(orch);
    vi.mocked(isTmuxAliveSync).mockReturnValue(true);
    expect(deliverToOrchestratorPane('orch-sid', 'oi', 'student')).toBe(false);
    expect(inputTerm).not.toHaveBeenCalled();
  });

  it('delivers into the pane instead of spawning a headless twin when the target IS the live Orchestrator session', () => {
    vi.mocked(readOrchestratorSync).mockReturnValue(orch);
    vi.mocked(isTmuxAliveSync).mockReturnValue(true);
    startRun({ ws, role: 'admin', sessionKey: 'orch-sid', prompt: 'oi', resumeId: 'orch-sid', msgId: 'm1' });
    expect(run).not.toHaveBeenCalled();
    expect(threads.has('orch-sid')).toBe(false);
    expect(openTerm).toHaveBeenCalledWith('cv-abc', 120, 40, expect.any(Function), expect.any(Function), expect.any(Function));
    expect(inputTerm).toHaveBeenCalledWith('cv-abc', '\x1b[200~oi\x1b[201~\r');
    expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({ t: 'user', sessionKey: 'orch-sid', id: 'm1', text: 'oi' }));
  });

  it('reuses an already-open pane pty instead of opening a second client onto the same tmux session', () => {
    vi.mocked(readOrchestratorSync).mockReturnValue(orch);
    vi.mocked(isTmuxAliveSync).mockReturnValue(true);
    vi.mocked(hasTerm).mockReturnValue(true);
    startRun({ ws, role: 'admin', sessionKey: 'orch-sid', prompt: 'oi', resumeId: 'orch-sid' });
    expect(openTerm).not.toHaveBeenCalled();
    expect(inputTerm).toHaveBeenCalledOnce();
  });

  it('falls through to a normal run when the tmux session is dead', () => {
    vi.mocked(readOrchestratorSync).mockReturnValue(orch);
    vi.mocked(isTmuxAliveSync).mockReturnValue(false);
    startRun({ ws, role: 'admin', sessionKey: 'orch-sid', prompt: 'oi', resumeId: 'orch-sid' });
    expect(run).toHaveBeenCalledOnce();
    expect(inputTerm).not.toHaveBeenCalled();
  });

  it('does not redirect a fork off the Orchestrator transcript — forking is a distinct, legitimate headless run', () => {
    vi.mocked(readOrchestratorSync).mockReturnValue(orch);
    vi.mocked(isTmuxAliveSync).mockReturnValue(true);
    startRun({ ws, sessionKey: 'fork-1', prompt: 'oi', resumeId: 'orch-sid', forkId: 'fork-1' });
    expect(run).toHaveBeenCalledOnce();
    expect(inputTerm).not.toHaveBeenCalled();
  });

  it('routeSend delivers into the pane too, even if a stray twin thread already sits under the sessionKey', () => {
    vi.mocked(readOrchestratorSync).mockReturnValue(orch);
    vi.mocked(isTmuxAliveSync).mockReturnValue(true);
    threads.set('orch-sid', { handle: { kill: vi.fn(), send: vi.fn(() => false) }, params: {}, prompt: 'p', startedAt: Date.now(), text: '', thinking: '', tools: [], toolStart: new Map(), taskNotifies: new Map(), tasks: new Map(), taskCreates: new Map(), appTried: new Set() } as any);
    routeSend({ ws, role: 'admin', sessionKey: 'orch-sid', prompt: 'oi de novo', resumeId: 'orch-sid', msgId: 'm2' });
    expect(inputTerm).toHaveBeenCalledWith('cv-abc', '\x1b[200~oi de novo\x1b[201~\r');
  });

  it('deliverToOrchestratorPane is false when no orchestrator is configured', () => {
    expect(deliverToOrchestratorPane('any-session', 'oi')).toBe(false);
    expect(inputTerm).not.toHaveBeenCalled();
  });

  // server/ws/dispatch.ts's cross-process 'send' guard reuses this predicate
  // (not deliverToOrchestratorPane itself, which also DOES the delivery) to
  // ask "would startRun redirect this into the Orchestrator's pane instead
  // of treating it as a conflicting run?" without duplicating the three
  // gates below.
  describe('orchestratorPaneTarget — same three gates, no delivery', () => {
    it('returns the matched OrchestratorInfo when target/role/tmux all line up', () => {
      vi.mocked(readOrchestratorSync).mockReturnValue(orch);
      vi.mocked(isTmuxAliveSync).mockReturnValue(true);
      expect(orchestratorPaneTarget('orch-sid', 'admin')).toEqual(orch);
      expect(inputTerm).not.toHaveBeenCalled(); // pure predicate, no side effect
    });

    it('is undefined for a non-admin role', () => {
      vi.mocked(readOrchestratorSync).mockReturnValue(orch);
      vi.mocked(isTmuxAliveSync).mockReturnValue(true);
      expect(orchestratorPaneTarget('orch-sid', 'student')).toBeUndefined();
    });

    it('is undefined for a session that is not the Orchestrator\'s', () => {
      vi.mocked(readOrchestratorSync).mockReturnValue(orch);
      vi.mocked(isTmuxAliveSync).mockReturnValue(true);
      expect(orchestratorPaneTarget('some-other-session', 'admin')).toBeUndefined();
    });

    it('is undefined once the tmux pane is dead', () => {
      vi.mocked(readOrchestratorSync).mockReturnValue(orch);
      vi.mocked(isTmuxAliveSync).mockReturnValue(false);
      expect(orchestratorPaneTarget('orch-sid', 'admin')).toBeUndefined();
    });

    it('is undefined when no orchestrator is configured at all', () => {
      expect(orchestratorPaneTarget('orch-sid', 'admin')).toBeUndefined();
    });
  });
});

describe('resumeOrphanRuns — never auto-resumes the Orchestrator headlessly', () => {
  beforeEach(() => {
    threads.clear();
    vi.mocked(run).mockClear();
    vi.mocked(readOrchestratorSync).mockReset().mockReturnValue(undefined);
    vi.mocked(inputTerm).mockReset();
  });

  it('drops the orphan silently instead of typing "continue de onde parou" into the live pane', () => {
    vi.mocked(readOrchestratorSync).mockReturnValue({ name: 'orch', sessionId: 'orch-sid', tmux: 'cockpit-cv-abc' });
    vi.mocked(takeOrphanRuns).mockReturnValueOnce([
      { sessionKey: 'orch-sid', sessionId: 'orch-sid', params: {}, startedAt: Date.now() },
    ]);
    resumeOrphanRuns();
    expect(run).not.toHaveBeenCalled();
    expect(inputTerm).not.toHaveBeenCalled();
    expect(threads.has('orch-sid')).toBe(false);
  });
});

describe('startRun — spawn throws synchronously', () => {
  const ws = {} as WebSocket;
  beforeEach(() => { threads.clear(); clearAllAwaiting(); resetColdInflight(); vi.mocked(broadcast).mockClear(); });

  it('frees the session instead of leaving it busy forever', () => {
    vi.mocked(run).mockImplementationOnce(() => { throw new Error('spawn ENOMEM'); });
    expect(() => startRun({ ws, sessionKey: 'sx', prompt: 'oi' })).not.toThrow();
    expect(threads.has('sx')).toBe(false);
    expect(coldInflightCount()).toBe(0);
    expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({ t: 'error', sessionKey: 'sx' }));
    expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({ t: 'done', sessionKey: 'sx', stopped: true }));
  });
});

describe('catchSpawn', () => {
  it('returns the handle or the error message', () => {
    expect(catchSpawn(() => 1)).toEqual({ handle: 1 });
    expect(catchSpawn(() => { throw new Error('boom'); })).toEqual({ error: 'boom' });
  });
});
