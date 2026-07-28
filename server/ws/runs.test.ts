import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { admitRun, findStaleThreads, startRun, threads, isSilentDeath, killAllRuns, resumeOrphanRuns, drainParked, startParkedDrainer, AUTO_RESUME_CAP, REAPER_SILENCE_CAP_MS, REAPER_TOTAL_CAP_MS } from './runs';
import { takeOrphanRuns } from './recover';
import { awaitingAnswer } from './awaiting';
import { broadcast } from './broadcast';
import { run } from '../engine/claude';
import { parkedHeads, shiftParked, unshiftParked, addParked, isQueuePaused, type ParkedItem } from './parked';
import { quotaHold } from './quota';

vi.mock('../engine/claude', () => ({ run: vi.fn(() => ({ kill: vi.fn() })) }));
// Fila estacionada e teto de tokens mockados: o teste não pode ler/escrever o
// parked.json real do usuário nem depender da quota da conta.
vi.mock('./parked', () => ({
  parkedHeads: vi.fn(() => []), shiftParked: vi.fn(), unshiftParked: vi.fn(),
  addParked: vi.fn(), parkedView: vi.fn(() => []), isQueuePaused: vi.fn(() => false),
}));
vi.mock('./quota', async (orig) => ({ ...(await orig<typeof import('./quota')>()), quotaHold: vi.fn(() => 0) }));
vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('./translate', () => ({ translate: vi.fn() }));
vi.mock('../summary', () => ({ summarize: vi.fn(async () => {}) }));
vi.mock('../engine/triage', () => ({ classify: vi.fn(), quickAnswer: vi.fn(), killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));
vi.mock('../engine/suggest', () => ({ suggestFollowups: vi.fn(async () => []) }));
vi.mock('./incidents', () => ({ recordIncident: vi.fn() })); // teste não escreve no log real de incidentes
vi.mock('./recover', () => ({ markRunLive: vi.fn(), clearRunLive: vi.fn(), takeOrphanRuns: vi.fn(() => []) }));

describe('findStaleThreads', () => {
  const now = 1_000_000_000;

  it('mata turno mudo além do teto de silêncio', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['a', { startedAt: now - 60_000, lastFrameAt: now - REAPER_SILENCE_CAP_MS - 1 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual(['a']);
  });

  it('preserva turno com frame recente', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['a', { startedAt: now - REAPER_SILENCE_CAP_MS - 1, lastFrameAt: now - 1000 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual([]);
  });

  it('mata turno vivo além do teto total mesmo com frames chegando', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['a', { startedAt: now - REAPER_TOTAL_CAP_MS - 1, lastFrameAt: now - 500 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual(['a']);
  });

  it('turno sem frame algum conta silêncio desde o início', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['fresh', { startedAt: now - 1000 }],
      ['old', { startedAt: now - REAPER_SILENCE_CAP_MS - 1 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual(['old']);
  });
});

describe('admitRun', () => {
  it('admits while live runs are below the cap', () => {
    expect(admitRun(0, false, 3)).toBe(true);
    expect(admitRun(2, false, 3)).toBe(true);
  });

  it('rejects a brand-new run once the cap is reached', () => {
    expect(admitRun(3, false, 3)).toBe(false);
    expect(admitRun(5, false, 3)).toBe(false);
  });

  it('always admits a run that replaces an existing key, even at the cap', () => {
    expect(admitRun(3, true, 3)).toBe(true);
    expect(admitRun(99, true, 3)).toBe(true);
  });
});

describe('startRun — latch awaitingAnswer (AskUserQuestion)', () => {
  const ws = {} as WebSocket;
  beforeEach(() => { threads.clear(); awaitingAnswer.clear(); vi.mocked(run).mockClear(); });

  it('estaciona um send AUTO enquanto a sessão aguarda resposta da pergunta', () => {
    awaitingAnswer.add('s1');
    startRun(ws, 's1', 'flush da fila', undefined, 'm1', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
    expect(run).not.toHaveBeenCalled();
    expect(threads.has('s1')).toBe(false);
    expect(awaitingAnswer.has('s1')).toBe(true); // latch intacto até a resposta real
  });

  it('send MANUAL limpa o latch, roda e o onClose drena o estacionado', () => {
    awaitingAnswer.add('s2');
    startRun(ws, 's2', 'auto estacionado', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
    expect(run).not.toHaveBeenCalled();
    startRun(ws, 's2', 'minha resposta à pergunta');
    expect(awaitingAnswer.has('s2')).toBe(false);
    expect(run).toHaveBeenCalledOnce();
    // Fecha o turno da resposta: o item estacionado vira o próximo turno.
    vi.mocked(run).mock.calls[0][0].onClose?.();
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.mocked(run).mock.calls[1][0].prompt).toBe('auto estacionado');
  });

  it('send AUTO sem latch roda normalmente', () => {
    startRun(ws, 's3', 'fila normal', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
    expect(run).toHaveBeenCalledOnce();
  });
});

describe('morte silenciosa do turno — aviso + retomada automática', () => {
  const ws = {} as WebSocket;
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
  const errors = () => vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m: any) => m.t === 'error');

  beforeEach(() => {
    threads.clear();
    awaitingAnswer.clear();
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
    startRun(ws, 'k1', 'trabalho longo', 'sess-1', undefined, 'plan', 'opus', 5, true, 'admin', ['x'], ['mcp1'], 'high');
    closeLastRun();
    expect(errors()).toHaveLength(1);
    expect(run).toHaveBeenCalledTimes(2);
    const resumed = vi.mocked(run).mock.calls[1][0];
    expect(resumed.resumeId).toBe('sess-1');
    expect(resumed.prompt).toContain('Continue exatamente de onde parou');
    expect(resumed).toMatchObject({ mode: 'plan', model: 'opus', maxBudgetUsd: 5, bypass: true, role: 'admin', effort: 'high' });
  });

  it('fechamento saudável não avisa nem retoma', () => {
    startRun(ws, 'k2', 'trabalho', 'sess-2');
    threads.get('k2')!.endReason = 'success';
    closeLastRun();
    expect(errors()).toHaveLength(0);
    expect(run).toHaveBeenCalledOnce();
  });

  it('stop do usuário não vira retomada', () => {
    startRun(ws, 'k3', 'trabalho', 'sess-3');
    threads.get('k3')!.stopped = true;
    closeLastRun();
    expect(errors()).toHaveLength(0);
    expect(run).toHaveBeenCalledOnce();
  });

  it('retoma no máximo AUTO_RESUME_CAP vezes seguidas', () => {
    startRun(ws, 'k4', 'trabalho', 'sess-4');
    for (let i = 0; i <= AUTO_RESUME_CAP + 1; i++) closeLastRun();
    expect(run).toHaveBeenCalledTimes(1 + AUTO_RESUME_CAP);
    expect(errors().at(-1)).toMatchObject({ message: expect.stringContaining('também falhou') });
  });

  it('turno saudável zera a cota — falha nova volta a ter direito a retomada', () => {
    startRun(ws, 'k5', 'trabalho', 'sess-5');
    closeLastRun();                                   // 1ª morte: retoma
    expect(run).toHaveBeenCalledTimes(2);
    threads.get('k5')!.endReason = 'success';
    closeLastRun();                                   // fecha bem: zera
    startRun(ws, 'k5', 'outro trabalho', 'sess-5');
    closeLastRun();                                   // morte nova: retoma de novo
    expect(vi.mocked(run).mock.calls.at(-1)![0].prompt).toContain('Continue exatamente de onde parou');
  });

  it('não retoma quando a sessão aguarda resposta do usuário', () => {
    startRun(ws, 'k6', 'trabalho', 'sess-6');
    awaitingAnswer.add('k6');
    closeLastRun();
    expect(run).toHaveBeenCalledOnce();
  });

  it('não retoma turno sem sessionId (sem --resume possível)', () => {
    startRun(ws, 'k7', 'trabalho');
    closeLastRun();
    expect(run).toHaveBeenCalledOnce();
  });

  // Regressão: killAllRuns (shutdown / guarda de pressão) fechava o turno sem marcar
  // stopped, então cada onClose parecia morte silenciosa e subia um turno novo — em
  // cima do processo saindo ou da VPS sob pressão, uma retomada por sessão.
  it('kill nosso (killAllRuns) não vira retomada automática', () => {
    startRun(ws, 'k8', 'trabalho', 'sess-8');
    startRun(ws, 'k9', 'outro', 'sess-9');
    killAllRuns();
    vi.mocked(run).mock.calls.forEach((c) => c[0].onClose?.());
    expect(run).toHaveBeenCalledTimes(2);
    expect(errors()).toHaveLength(0);
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
    startRun({} as WebSocket, 'sess-orfa', 'reenviei na mão');
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
    awaitingAnswer.clear();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(quotaHold).mockReturnValue(0);
    vi.mocked(isQueuePaused).mockReturnValue(false);
    vi.mocked(parkedHeads).mockReturnValue([]);
    vi.mocked(shiftParked).mockReset();
    vi.mocked(unshiftParked).mockClear();
    vi.mocked(addParked).mockClear();
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

  it('devolve pro topo da fila o item cujo turno morreu no limite', () => {
    const it0 = item();
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's2', first: it0 }]);
    vi.mocked(shiftParked).mockReturnValue(it0);
    drainParked();
    limited(); // a quota estourou durante o turno
    closeLastRun();
    expect(unshiftParked).toHaveBeenCalledWith('s2', it0);
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

  it('devolve pra fila o item que nem chegou a subir (teto de sessões)', () => {
    const it0 = item();
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 'bad key!', first: it0 }]);
    vi.mocked(shiftParked).mockReturnValue(it0);
    drainParked();
    expect(run).not.toHaveBeenCalled();
    expect(unshiftParked).toHaveBeenCalledWith('bad key!', it0);
  });

  it('sem token, a fila in-turn vira estacionada em vez de disparar', () => {
    awaitingAnswer.add('s4');
    startRun(ws, 's4', 'item enfileirado', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
    startRun(ws, 's4', 'resposta do usuário');
    limited();
    closeLastRun();
    expect(addParked).toHaveBeenCalledWith('s4', expect.objectContaining({ prompt: 'item enfileirado' }));
    expect(run).toHaveBeenCalledOnce();
  });
});
