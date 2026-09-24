import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  admitRun, busyFrame, threads, onStop, stopSession, onBudgetStop, stopSessionForBudget,
  resolveThreadKey, stopEpochOf, clearStopEpoch, killAllRuns, runStats, type Thread,
} from './threads';

vi.mock('../engine/triage', () => ({ killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));

const kill = vi.fn();
const thread = (sessionId?: string): Thread => ({
  handle: { kill, send: () => false }, params: {}, prompt: 'p', startedAt: Date.now(), sessionId,
  text: '', thinking: '', tools: [], toolStart: new Map(), taskNotifies: new Map(),
  tasks: new Map(), taskCreates: new Map(), appTried: new Set(),
});

beforeEach(() => {
  threads.clear();
  kill.mockClear();
  for (const k of ['k1', 'k2', 'ghost', 'new-a', 'sid-1']) clearStopEpoch(k);
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

describe('resolveThreadKey', () => {
  it('prefere a chave direta', () => {
    threads.set('k1', thread('sid-1'));
    expect(resolveThreadKey('k1')).toBe('k1');
  });

  // O servidor keyeia pela chave com que o run começou ('new-…') e nunca re-keyea;
  // o cliente migra o display pro sessionId. Um stop com a chave migrada dava miss.
  it('cai pro sessionId quando a chave direta não existe', () => {
    threads.set('new-a', thread('sid-1'));
    expect(resolveThreadKey('sid-1')).toBe('new-a');
  });

  it('devolve undefined pra sessão sem turno', () => {
    expect(resolveThreadKey('ghost')).toBeUndefined();
  });
});

describe('onStop', () => {
  it('bumpa a época e marca o turno como parado pelo usuário', () => {
    threads.set('k1', thread());
    onStop('k1');
    expect(stopEpochOf('k1')).toBe(1);
    expect(threads.get('k1')).toMatchObject({ stopped: true, userStopped: true });
  });

  // A época só é apagada no onClose de um turno. Sem turno vivo não há triagem em
  // voo pra invalidar, então bumpar aqui deixava a entrada presa no mapa pra sempre
  // — e stop de sessão já fechada é o caso comum (clique repetido no botão).
  it('não deixa época presa quando a sessão não tem turno', () => {
    onStop('ghost');
    expect(stopEpochOf('ghost')).toBe(0);
  });

  it('stop numa sessão morta não apaga a época de outra que ainda roda', () => {
    threads.set('k1', thread());
    onStop('k1');
    onStop('ghost');
    expect(stopEpochOf('k1')).toBe(1);
  });
});

describe('stopSession', () => {
  it('mata o turno pela chave migrada', () => {
    threads.set('new-a', thread('sid-1'));
    stopSession('sid-1');
    expect(kill).toHaveBeenCalledTimes(1);
    expect(threads.get('new-a')?.userStopped).toBe(true);
  });

  it('sessão fantasma não quebra nem mata ninguém', () => {
    threads.set('k1', thread());
    stopSession('ghost');
    expect(kill).not.toHaveBeenCalled();
  });
});

describe('onBudgetStop / stopSessionForBudget', () => {
  it('marca budgetStopped com o motivo, NUNCA userStopped', () => {
    threads.set('k1', thread());
    onBudgetStop('k1', 'cpu 120% > 100%');
    expect(threads.get('k1')).toMatchObject({ stopped: true, budgetStopped: true, budgetStopReason: 'cpu 120% > 100%' });
    expect(threads.get('k1')?.userStopped).toBeUndefined();
  });

  it('mata o turno pela chave migrada, como o stop normal', () => {
    threads.set('new-a', thread('sid-1'));
    stopSessionForBudget('sid-1', 'contexto 900k > 500k');
    expect(kill).toHaveBeenCalledTimes(1);
    expect(threads.get('new-a')).toMatchObject({ budgetStopped: true, budgetStopReason: 'contexto 900k > 500k' });
  });

  it('sessão fantasma não quebra nem mata ninguém', () => {
    stopSessionForBudget('ghost', 'x');
    expect(kill).not.toHaveBeenCalled();
  });
});

describe('killAllRuns', () => {
  // Kill NOSSO: marca stopped (pra o onClose não chamar de morte silenciosa) mas
  // NÃO userStopped — o prompt da fila não foi consumido e tem que voltar.
  it('marca stopped sem marcar userStopped', () => {
    threads.set('k1', thread());
    threads.set('k2', thread());
    killAllRuns();
    expect(kill).toHaveBeenCalledTimes(2);
    expect(threads.get('k1')).toMatchObject({ stopped: true });
    expect(threads.get('k1')?.userStopped).toBeUndefined();
  });

  it('handle que já morreu não derruba o resto da árvore', () => {
    threads.set('k1', { ...thread(), handle: { kill: () => { throw new Error('já morto'); }, send: () => false } });
    threads.set('k2', thread());
    expect(() => killAllRuns()).not.toThrow();
    expect(kill).toHaveBeenCalledTimes(1);
  });
});

describe('runStats', () => {
  it('conta os turnos vivos', () => {
    threads.set('k1', thread());
    expect(runStats().activeRuns).toBe(1);
    expect(runStats().uptimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('busyFrame', () => {
  afterEach(() => threads.clear());

  it('carries each running turn start so a reload keeps the real elapsed time', () => {
    threads.set('abc', { startedAt: 1_000 } as Thread);
    threads.set('new-x', { startedAt: 2_000 } as Thread);
    expect(busyFrame()).toEqual({ t: 'busy', keys: ['abc', 'new-x'], startedAt: { abc: 1_000, 'new-x': 2_000 } });
  });

  it('is an empty snapshot when nothing runs', () => {
    expect(busyFrame()).toEqual({ t: 'busy', keys: [], startedAt: {} });
  });
});
