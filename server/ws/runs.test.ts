import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { admitRun, findStaleThreads, reapStaleRuns, startRun, threads, isSilentDeath, killAllRuns, resumeOrphanRuns, drainParked, startParkedDrainer, AUTO_RESUME_CAP, REAPER_SILENCE_CAP_MS, REAPER_TOOL_SILENCE_CAP_MS, REAPER_TOTAL_CAP_MS } from './runs';
import { takeOrphanRuns } from './recover';
import { recordIncident } from './incidents';
import { awaitingAnswer } from './awaiting';
import { broadcast } from './broadcast';
import { run } from '../engine/claude';
import { parkedHeads, shiftParked, unshiftParked, addParked, isQueuePaused, type ParkedItem } from './parked';
import { resumableId } from './resume';
import { quotaHold } from './quota';
import { reportOutcome } from '../router/state';

vi.mock('../engine/claude', () => ({ run: vi.fn(() => ({ kill: vi.fn() })) }));
// Fila estacionada e teto de tokens mockados: o teste não pode ler/escrever o
// parked.json real do usuário nem depender da quota da conta.
vi.mock('./parked', () => ({
  parkedHeads: vi.fn(() => []), shiftParked: vi.fn(), unshiftParked: vi.fn(() => 1),
  addParked: vi.fn(() => ({ id: 'pk-mock' })), parkedView: vi.fn(() => []), isQueuePaused: vi.fn(() => false),
  setQueuePaused: vi.fn(), MAX_PARKED_ATTEMPTS: 3,
}));
// Por padrão todo resumeId é vivo; o teste do transcript morto sobrescreve.
vi.mock('./resume', () => ({ resumableId: vi.fn((id?: string) => id) }));
vi.mock('./quota', async (orig) => ({ ...(await orig<typeof import('./quota')>()), quotaHold: vi.fn(() => 0) }));
vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('./translate', () => ({ translate: vi.fn() }));
vi.mock('../summary', () => ({ summarize: vi.fn(async () => {}) }));
vi.mock('../engine/triage', () => ({ classify: vi.fn(), quickAnswer: vi.fn(), killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));
vi.mock('../engine/suggest', () => ({ suggestFollowups: vi.fn(async () => []) }));
vi.mock('./incidents', () => ({ recordIncident: vi.fn() })); // teste não escreve no log real de incidentes
vi.mock('./recover', () => ({ markRunLive: vi.fn(), clearRunLive: vi.fn(), takeOrphanRuns: vi.fn(() => []) }));
// Roteador mockado: fechar um turno de mentira não pode escrever o routes.json
// real nem trocar a rota da máquina do usuário.
vi.mock('../router/state', () => ({
  reportOutcome: vi.fn(() => ({ kind: 'ok', changed: null })),
  isPlanRoute: vi.fn(() => true),
  hasFallbackRoute: vi.fn(() => false),
  switchOnPlanExhausted: vi.fn(() => null),
}));

describe('findStaleThreads', () => {
  const now = 1_000_000_000;
  type Entry = [string, { startedAt: number; lastFrameAt?: number; openToolsAt?: number[] }];
  const keys = (e: Entry[]) => findStaleThreads(now, e).map((v) => v.key);

  it('mata turno mudo além do teto de silêncio', () => {
    const entries: Entry[] = [['a', { startedAt: now - 60_000, lastFrameAt: now - REAPER_SILENCE_CAP_MS - 1 }]];
    expect(findStaleThreads(now, entries)).toEqual([{ key: 'a', reason: 'silence', ms: REAPER_SILENCE_CAP_MS + 1 }]);
  });

  it('preserva turno com frame recente', () => {
    const entries: Entry[] = [['a', { startedAt: now - REAPER_SILENCE_CAP_MS - 1, lastFrameAt: now - 1000 }]];
    expect(keys(entries)).toEqual([]);
  });

  // A regressão que o Samuel sentiu como "o turno só roda com a janela aberta": o
  // teto absoluto de 45min matava turno em pleno progresso.
  it('preserva turno longo que segue emitindo frames', () => {
    const entries: Entry[] = [['a', { startedAt: now - 3 * 60 * 60_000, lastFrameAt: now - 1000 }]];
    expect(keys(entries)).toEqual([]);
  });

  it('poupa silêncio longo enquanto uma tool está em voo', () => {
    const silent = now - REAPER_SILENCE_CAP_MS - 1;
    expect(keys([['a', { startedAt: now - 60_000, lastFrameAt: silent, openToolsAt: [now - 60_000] }]])).toEqual([]);
  });

  it('mata tool travada além do teto de tool', () => {
    const entries: Entry[] = [['a', { startedAt: now - 60_000, lastFrameAt: now - REAPER_TOOL_SILENCE_CAP_MS - 1, openToolsAt: [now - 1000, now - 2000] }]];
    expect(findStaleThreads(now, entries)[0]).toMatchObject({ key: 'a', reason: 'tool' });
  });

  // toolStart é grudento: um tool_use sem tool_result deixa a chave lá pro resto do
  // turno. Se "em voo" fosse só contagem, esse fantasma rebaixaria o teto de 15 pra
  // 90min pra sempre — o turno travado sobreviveria 6x mais que devia.
  it('ignora tool aberta há mais que o próprio teto de tool', () => {
    const entries: Entry[] = [['a', { startedAt: now - 3 * 60 * 60_000, lastFrameAt: now - REAPER_SILENCE_CAP_MS - 1, openToolsAt: [now - REAPER_TOOL_SILENCE_CAP_MS - 1] }]];
    expect(findStaleThreads(now, entries)[0]).toMatchObject({ key: 'a', reason: 'silence' });
  });

  it('mata turno além do teto total mesmo com frames chegando', () => {
    const entries: Entry[] = [['a', { startedAt: now - REAPER_TOTAL_CAP_MS - 1, lastFrameAt: now - 500 }]];
    expect(findStaleThreads(now, entries)[0]).toMatchObject({ key: 'a', reason: 'total' });
  });

  it('turno sem frame algum conta silêncio desde o início', () => {
    const entries: Entry[] = [
      ['fresh', { startedAt: now - 1000 }],
      ['old', { startedAt: now - REAPER_SILENCE_CAP_MS - 1 }],
    ];
    expect(keys(entries)).toEqual(['old']);
  });

  it('respeita tetos injetados', () => {
    const entries: Entry[] = [['a', { startedAt: now - 5000, lastFrameAt: now - 4000 }]];
    expect(keys(entries)).toEqual([]);
    expect(findStaleThreads(now, entries, { silence: 3000 }).map((v) => v.key)).toEqual(['a']);
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

  // Kill do reaper usa stopped (pra não notificar "concluído") mas NÃO é stop do
  // usuário: antes o turno reapado morria sem retomada e sem ninguém ver.
  it('turno reapado retoma sozinho', () => {
    startRun(ws, 'k3b', 'trabalho longo', 'sess-3b');
    Object.assign(threads.get('k3b')!, { stopped: true, reaped: 'silence' });
    closeLastRun();
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.mocked(run).mock.calls[1][0].prompt).toContain('Continue exatamente de onde parou');
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
    awaitingAnswer.clear();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(recordIncident).mockClear();
  });

  it('marca reaped, registra incidente e o onClose retoma o turno', () => {
    startRun(ws, 'r1', 'trabalho longo', 'sess-r1');
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
    startRun(ws, 'r2', 'trabalho', 'sess-r2');
    age('r2', { lastFrameAt: Date.now() - REAPER_SILENCE_CAP_MS - 1 });
    reapStaleRuns();
    reapStaleRuns();
    expect(recordIncident).toHaveBeenCalledOnce();
    expect(errors()).toHaveLength(1);
  });

  it('poupa turno mudo com tool em voo (teto de tool, não de silêncio)', () => {
    startRun(ws, 'r3', 'build longo', 'sess-r3');
    age('r3', { lastFrameAt: Date.now() - REAPER_SILENCE_CAP_MS - 1 });
    threads.get('r3')!.toolStart.set('tool-1', Date.now() - 60_000);
    reapStaleRuns();
    expect(threads.get('r3')!.reaped).toBeUndefined();
  });

  it('teto total não retoma — é a rede final contra run desgovernado', () => {
    startRun(ws, 'r4', 'trabalho', 'sess-r4');
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

  // O item segurado é o TOPO da fila e a fila drena do topo: sem o skip, o drainer
  // redispararia pra sempre o item que já falhou 3x e nenhum item atrás dele sairia.
  it('pula o item segurado sem travar o tick', () => {
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 's5', first: item({ held: true }) }]);
    drainParked();
    expect(shiftParked).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
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
    awaitingAnswer.add('s4');
    startRun(ws, 's4', 'item enfileirado', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
    startRun(ws, 's4', 'resposta do usuário');
    limited();
    closeLastRun();
    expect(addParked).toHaveBeenCalledWith('s4', expect.objectContaining({ prompt: 'item enfileirado' }));
    expect(run).toHaveBeenCalledOnce();
  });
});

// O breaker do roteador só aprende pelo veredito do fim de turno: se `reportOutcome`
// não for chamado aqui, nenhum provedor entra em cooldown e o failover nunca sai
// do papel. E se for chamado no stop do usuário, um Ctrl-C vira "provedor falhou".
describe('fim de turno — veredito do roteador', () => {
  const ws = {} as WebSocket;
  const closeLastRun = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();

  beforeEach(() => {
    threads.clear();
    awaitingAnswer.clear();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    vi.mocked(reportOutcome).mockClear();
    vi.mocked(quotaHold).mockReturnValue(0);
  });

  it('reporta o turno fechado com o que ele produziu', () => {
    startRun(ws, 'ro1', 'trabalho', 'sess-ro1');
    const t = threads.get('ro1')!;
    t.text = 'pronto';
    t.tools.push({ id: 'x', name: 'Read', input: '', ts: 1 } as never);
    t.endReason = 'success';
    closeLastRun();
    expect(reportOutcome).toHaveBeenCalledOnce();
    expect(vi.mocked(reportOutcome).mock.calls[0][0]).toMatchObject({ tools: 1, text: 'pronto' });
  });

  it('stop do usuário não abre breaker de provedor nenhum', () => {
    startRun(ws, 'ro2', 'trabalho', 'sess-ro2');
    Object.assign(threads.get('ro2')!, { stopped: true, userStopped: true });
    closeLastRun();
    expect(reportOutcome).not.toHaveBeenCalled();
  });

  // Kill NOSSO (reaper, deploy, guarda de pressão) não é stop do usuário: continua
  // valendo como sinal, senão um provedor que trava o turno nunca seria penalizado.
  it('kill nosso segue reportando', () => {
    startRun(ws, 'ro3', 'trabalho', 'sess-ro3');
    Object.assign(threads.get('ro3')!, { stopped: true, reaped: 'silence' });
    closeLastRun();
    expect(reportOutcome).toHaveBeenCalledOnce();
  });

  it('leva o erro do turno junto (é o texto que classifica a falha)', () => {
    startRun(ws, 'ro4', 'trabalho', 'sess-ro4');
    threads.get('ro4')!.lastError = '429 rate_limit_error';
    threads.get('ro4')!.endReason = 'error';
    closeLastRun();
    expect(vi.mocked(reportOutcome).mock.calls[0][0]).toMatchObject({ error: '429 rate_limit_error' });
  });

  // A ORDEM importa: o veredito troca a rota, e só depois o quotaHold decide se
  // ainda há motivo pra segurar. Invertido, o hold responderia pela rota velha.
  it('reporta antes de consultar o teto de tokens', () => {
    const order: string[] = [];
    vi.mocked(reportOutcome).mockImplementation(() => { order.push('outcome'); return { kind: 'ok', changed: null }; });
    vi.mocked(quotaHold).mockImplementation(() => { order.push('hold'); return 0; });
    startRun(ws, 'ro5', 'trabalho', 'sess-ro5');
    threads.get('ro5')!.endReason = 'success';
    closeLastRun();
    expect(order.indexOf('outcome')).toBe(0);
    expect(order).toContain('hold');
  });
});

// A maratona é a lane do prompt de 21h: o teto de VIDA de 8h a mataria em plena
// produção, mas os tetos de silêncio têm que continuar valendo — na maratona
// ninguém está olhando pra perceber que travou.
describe('tetos da maratona', () => {
  const T = 60_000;

  it('turno comum morre no teto de vida; maratona não', () => {
    const velho = { startedAt: 0, lastFrameAt: 9 * 60 * 60_000 };
    const now = 9 * 60 * 60_000;
    expect(findStaleThreads(now, [['a', velho]])).toEqual([{ key: 'a', reason: 'total', ms: now }]);
    expect(findStaleThreads(now, [['a', { ...velho, marathon: true }]])).toEqual([]);
  });

  it('maratona muda ainda é reapada por silêncio', () => {
    const now = 9 * 60 * 60_000;
    const mudo = { startedAt: 0, lastFrameAt: now - 20 * T, marathon: true };
    expect(findStaleThreads(now, [['a', mudo]])[0]).toMatchObject({ reason: 'silence' });
  });

  it('maratona também tem um fim: 72h', () => {
    const now = 73 * 60 * 60_000;
    const vivo = { startedAt: 0, lastFrameAt: now - 1, marathon: true };
    expect(findStaleThreads(now, [['a', vivo]])[0]).toMatchObject({ reason: 'total' });
  });
});
