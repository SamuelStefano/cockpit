// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotes } from './useNotes';
import { useCrons } from './useCrons';
import { usePoints } from './usePoints';
import { useContexts } from './useContexts';
import { useSkills } from './useSkills';
import { useGraphs } from './useGraphs';
import { useAdmin } from './useAdmin';
import { useHarness } from './useHarness';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';

// O useCockpit repassa cada frame pela corrente de hooks e para no primeiro que
// devolve true. Dois hooks reivindicando o mesmo tipo = o segundo nunca vê o frame
// e o bug aparece só em runtime, num painel que silenciosamente para de atualizar.
// Este teste é a guarda: as reivindicações têm que ser disjuntas.
const send = vi.fn((_m: ClientMsg) => true);

const CADEIA = ['notes', 'crons', 'points', 'contexts', 'skills', 'graphs', 'admin', 'harness'] as const;

const montarCadeia = () => renderHook(() => ({
  notes: useNotes(send).onMsg,
  crons: useCrons(send).onMsg,
  points: usePoints(send).onMsg,
  contexts: useContexts(send).onMsg,
  skills: useSkills(send).onMsg,
  graphs: useGraphs(send).onMsg,
  admin: useAdmin(send).onMsg,
  harness: useHarness(send).onMsg,
})).result.current;

// Um frame representativo de cada tipo que a corrente deve reivindicar, e de quem.
const FRAMES: [ServerMsg, (typeof CADEIA)[number]][] = [
  [{ t: 'notes', text: '' }, 'notes'],
  [{ t: 'crons', items: [] }, 'crons'],
  [{ t: 'points', entries: [], total: 0 }, 'points'],
  [{ t: 'points-dfl', snapshot: null }, 'points'],
  [{ t: 'points-dfl-syncing' }, 'points'],
  [{ t: 'points-dfl-write', reqId: 'r', kind: 'change', ok: true }, 'points'],
  [{ t: 'contexts', items: [] }, 'contexts'],
  [{ t: 'context', id: 'c', title: 't', body: 'b' }, 'contexts'],
  [{ t: 'skills', items: [] }, 'skills'],
  [{ t: 'skill', id: 's', name: 'n', body: 'b' }, 'skills'],
  [{ t: 'graphs', items: [] }, 'graphs'],
  [{ t: 'graph-build-progress', line: 'l' }, 'graphs'],
  [{ t: 'graph-build-done', ok: true }, 'graphs'],
  [{ t: 'health', health: { claudeCli: true, sqlite: true, disk: 0, uptime: 0 } as never }, 'admin'],
  [{ t: 'accounts', accounts: [] }, 'admin'],
  [{ t: 'admin-op', ok: true, message: '' }, 'admin'],
  [{ t: 'harness-tasks', tasks: [] }, 'harness'],
  [{ t: 'harness-event', taskId: 'a', event: { kind: 'text', text: '' } }, 'harness'],
];

describe('corrente de dispatch dos domínios-folha', () => {
  it.each(FRAMES.map(([m, dono]) => [m.t, dono, m] as const))('%s é só do %s', (_t, dono, msg) => {
    const cadeia = montarCadeia();
    const reivindicou = CADEIA.filter((nome) => cadeia[nome](msg));
    expect(reivindicou).toEqual([dono]);
  });

  // Frames de sessão/turno seguem no switch do useCockpit — nenhum hook pode
  // interceptá-los, senão o chat para de renderizar.
  it.each([
    { t: 'stats', stats: {} as never },
    { t: 'search-results', q: '', items: [] },
    { t: 'handoff-result', ok: true, contextId: 'c' },
  ] as ServerMsg[])('nenhum hook reivindica $t', (msg) => {
    const cadeia = montarCadeia();
    expect(CADEIA.filter((nome) => cadeia[nome](msg))).toEqual([]);
  });
});
