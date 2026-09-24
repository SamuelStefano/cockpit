import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Fila REAL em disco (o runs.test.ts mocka ./parked inteiro): o bug de furar a fila
// vive na costura entre o parked.json e o registro de turnos, não em cada um deles.
const dir = mkdtempSync(join(tmpdir(), 'deck-parked-'));
process.env.COCKPIT_PARKED = join(dir, 'parked.json');
process.env.COCKPIT_QUEUE_PAUSE = join(dir, 'queue-paused.json');
process.env.COCKPIT_AWAITING = join(dir, 'awaiting.json');

vi.mock('../db', () => ({ lastUsageOf: () => null }));
vi.mock('../engine/claude', () => ({
  run: vi.fn(() => ({ kill: vi.fn() })),
  resolveMcpSelection: vi.fn(() => undefined),
}));
vi.mock('./resume', () => ({ resumableId: vi.fn((id?: string) => id) }));
vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('./translate', () => ({ translate: vi.fn() }));
vi.mock('../summary', () => ({ summarize: vi.fn(async () => {}) }));
vi.mock('../engine/triage', () => ({ classify: vi.fn(), quickAnswer: vi.fn(), killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));
vi.mock('../engine/suggest', () => ({ suggestFollowups: vi.fn(async () => []) }));
vi.mock('./incidents', () => ({ recordIncident: vi.fn() }));
vi.mock('./recover', () => ({ markRunLive: vi.fn(), clearRunLive: vi.fn(), takeOrphanRuns: vi.fn(() => []) }));

import { startRun, runParkedNow, startParkedDrainer } from './runs';
import { threads } from './threads';
import { addParked, parkedView, clearParked } from './parked';
import { broadcast } from './broadcast';
import { run } from '../engine/claude';

const lastPrompt = () => vi.mocked(run).mock.calls.at(-1)![0].prompt;
const closeLast = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
const queued = () => parkedView().map((p) => p.text);
const fill = () => ['A', 'B', 'C'].map((prompt) => (addParked('s1', { prompt }) as { id: string }).id);

describe('runParkedNow — furar a fila', () => {
  beforeEach(() => {
    threads.clear();
    clearParked('s1', 'admin');
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
  });

  // O turno em andamento é morto e o item sobe NO ATO, sem depender do dreno do
  // onClose: esse dreno é no-op fora do processo do agente (drainerEnabled), e o
  // Deck roda index e agente sobre o mesmo parked.json.
  it('sobe o item mesmo com o drainer desligado neste processo', () => {
    const [, b] = fill();
    startRun({ ws: null, sessionKey: 's1', prompt: 'turno em andamento' });
    expect(runParkedNow('s1', b)).toEqual({ ok: true });
    expect(lastPrompt()).toBe('B');
  });

  it('deixa os demais itens na fila', () => {
    const [, b] = fill();
    startRun({ ws: null, sessionKey: 's1', prompt: 'turno em andamento' });
    runParkedNow('s1', b);
    expect(queued()).toEqual(['A', 'C']);
  });

  // Turno que morreu sem produzir nada não consumiu o prompt: o item volta pro topo
  // e os que ficaram na fila continuam intactos.
  it('devolve o item pro topo se o turno morrer calado', () => {
    const [, b] = fill();
    startRun({ ws: null, sessionKey: 's1', prompt: 'turno em andamento' });
    runParkedNow('s1', b);
    closeLast();
    expect(queued()).toEqual(['B', 'A', 'C']);
  });

  it('avisa os clientes da fila nova', () => {
    const [, b] = fill();
    startRun({ ws: null, sessionKey: 's1', prompt: 'turno em andamento' });
    runParkedNow('s1', b);
    const snaps = vi.mocked(broadcast).mock.calls.map((c) => c[0]).filter((m) => (m as { t: string }).t === 'queue');
    expect(snaps.at(-1)).toMatchObject({ items: [{ text: 'A' }, { text: 'C' }] });
  });

  // O item fica amarrado ao turno: se ele morrer sem consumir o prompt (teto de
  // tokens, crash), o onClose devolve pra fila em vez de queimar o prompt.
  it('amarra o item ao turno que subiu', () => {
    const [, b] = fill();
    startRun({ ws: null, sessionKey: 's1', prompt: 'turno em andamento' });
    runParkedNow('s1', b);
    expect(threads.get('s1')?.parked?.prompt).toBe('B');
  });

  it('sessão ociosa: promove pro topo e deixa o drainer subir', () => {
    startParkedDrainer(3_600_000);
    const [, b] = fill();
    expect(runParkedNow('s1', b)).toEqual({ ok: true });
    expect(lastPrompt()).toBe('B');
    expect(queued()).toEqual(['A', 'C']);
  });

  it('item que não existe mais não mata o turno em andamento', () => {
    fill();
    startRun({ ws: null, sessionKey: 's1', prompt: 'turno em andamento' });
    const before = threads.get('s1');
    expect(runParkedNow('s1', 'pk-inexistente')).toEqual({ reject: 'sem-item' });
    expect(threads.get('s1')).toBe(before);
    expect(queued()).toEqual(['A', 'B', 'C']);
  });
});

process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

describe('runParkedNow — turno vivo com outra chave', () => {
  beforeEach(() => {
    threads.clear();
    clearParked('s1', 'admin');
    vi.mocked(run).mockClear();
  });

  // Primeiro turno de um chat novo roda como new-…; a fila usa o id da sessão.
  it('substitui o thread vivo (new-…) em vez de subir um segundo na chave da fila', () => {
    const [, b] = fill();
    startRun({ ws: null, sessionKey: 'new-abc', prompt: 'primeiro turno' });
    threads.get('new-abc')!.sessionId = 's1';
    expect(runParkedNow('s1', b)).toEqual({ ok: true });
    expect(threads.has('s1')).toBe(false);
    expect(threads.get('new-abc')?.parked?.prompt).toBe('B');
    expect(threads.get('new-abc')?.parkedFrom).toBe('s1');
  });
});
