import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { startRun, routeSend, isSilentDeath, resumeOrphanRuns, drainParked, runParkedInBackground, runParkedNow, startParkedDrainer, AUTO_RESUME_CAP } from './runs';
import { threads, killAllRuns } from './threads';
import { reapStaleRuns, REAPER_SILENCE_CAP_MS, REAPER_TOOL_SILENCE_CAP_MS, REAPER_TOTAL_CAP_MS } from './reaper';
import { takeOrphanRuns } from './recover';
import { recordIncident } from './incidents';
import { isAwaiting, setAwaiting, clearAllAwaiting } from './awaiting';
import { broadcast } from './broadcast';
import { run } from '../engine/claude';
import { parkedHeads, shiftParked, unshiftParked, addParked, findParked, takeParked, promoteParked, isQueuePaused, type ParkedItem } from './parked';
import { resumableId } from './resume';
import { quotaHold } from './quota';
import { classify } from '../engine/triage';

vi.mock('../engine/claude', () => ({ run: vi.fn(() => ({ kill: vi.fn() })) }));
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
    expect(errors().at(-1)).toMatchObject({ message: expect.stringContaining('também falhou') });
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

  it('o modelo escolhido na hora vence o que estava enfileirado', () => {
    vi.mocked(findParked).mockReturnValue(item({ model: 'opus' }));
    vi.mocked(takeParked).mockReturnValue(item({ model: 'opus' }));
    runParkedInBackground('s1', 'pk-9', 'admin', 'haiku');
    expect(vi.mocked(run).mock.calls[0][0].model).toBe('haiku');
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
    vi.mocked(parkedHeads).mockReturnValue([]);
    vi.mocked(shiftParked).mockReset();
    startParkedDrainer(3_600_000);
  });

  it('promove o item e mata o turno em andamento; o dreno do onClose sobe justo ele', () => {
    startRun({ ws, sessionKey: 'now1', prompt: 'o que estava rodando' });
    const kill = lastKill();
    expect(runParkedNow('now1', 'pk-9')).toEqual({ ok: true });
    expect(promoteParked).toHaveBeenCalledWith('now1', 'pk-9');
    expect(kill).toHaveBeenCalled();
    // O item promovido é o topo, e o topo é o que o dreno do onClose pega.
    vi.mocked(parkedHeads).mockReturnValue([{ sessionKey: 'now1', first: item() }]);
    vi.mocked(shiftParked).mockReturnValue(item());
    closeLastRun();
    expect(vi.mocked(run).mock.calls.at(-1)![0].prompt).toBe('esse aqui primeiro');
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
