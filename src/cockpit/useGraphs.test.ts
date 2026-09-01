// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGraphs } from './useGraphs';
import type { ClientMsg, GraphData } from '../../shared/protocol';

const grafo: GraphData = { directed: true, nodes: [], edges: [], communities: [], truncated: false, totalNodes: 0, totalEdges: 0 };
const resposta = (question: string, miss = false) => ({ t: 'graph-query-result', id: 'g1', question, answer: 'a', tokens: 10, miss }) as const;

const montar = () => {
  const enviados: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { enviados.push(m); return true; });
  return { ...renderHook(() => useGraphs(send)), enviados };
};

const abrir = (r: { current: ReturnType<typeof useGraphs> }, id = 'g1') => {
  act(() => { r.current.onGraphOpen(id); });
  act(() => { r.current.onMsg({ t: 'graph-data', id, graph: grafo }); });
};

describe('useGraphs', () => {
  it('abrir limpa o spinner e reseta o resultado do grafo anterior', () => {
    const { result } = montar();
    abrir(result);
    act(() => { result.current.onMsg(resposta('p1')); });
    expect(result.current.graphQueryResult?.question).toBe('p1');
    abrir(result, 'g2');
    expect(result.current.graphOpenId).toBe('g2');
    expect(result.current.graphOpening).toBe(null);
    expect(result.current.graphQueryResult).toBe(null);
    expect(result.current.graphQueryHistory).toEqual([]);
  });

  it('histórico ignora miss e deduplica por pergunta', () => {
    const { result } = montar();
    abrir(result);
    act(() => { result.current.onMsg(resposta('p1')); });
    act(() => { result.current.onMsg(resposta('vazia', true)); });
    act(() => { result.current.onMsg(resposta('p1')); });
    expect(result.current.graphQueryHistory.map((h) => h.question)).toEqual(['p1']);
  });

  // As ações de consulta liam o graphOpenId do STATE, então cada abertura recriava
  // os callbacks e remontava quem os recebe. O espelho em ref manda a chave certa
  // sem entrar na dep array.
  it('onGraphQuery e onGraphNodeOp são estáveis entre aberturas', () => {
    const { result } = montar();
    abrir(result);
    const q = result.current.onGraphQuery;
    const op = result.current.onGraphNodeOp;
    abrir(result, 'g2');
    expect(result.current.onGraphQuery).toBe(q);
    expect(result.current.onGraphNodeOp).toBe(op);
  });

  it('a consulta usa o grafo aberto no momento, não o da criação do callback', () => {
    const { result, enviados } = montar();
    abrir(result);
    const q = result.current.onGraphQuery;
    abrir(result, 'g2');
    act(() => { q('pergunta'); });
    expect(enviados[enviados.length - 1]).toEqual({ t: 'graph-query', id: 'g2', question: 'pergunta', budget: undefined });
    expect(result.current.graphQuerying).toBe(true);
  });

  it('sem grafo aberto a consulta não sai', () => {
    const { result, enviados } = montar();
    act(() => { result.current.onGraphQuery('p'); result.current.onGraphNodeOp('explain', 'n'); });
    expect(enviados).toEqual([]);
    expect(result.current.graphQuerying).toBe(false);
  });

  it('apagar o grafo aberto fecha a viz e libera a chave', () => {
    const { result, enviados } = montar();
    abrir(result);
    act(() => { result.current.onGraphDelete('g1'); });
    expect(result.current.graphOpenId).toBe(null);
    expect(result.current.graphData).toBe(null);
    act(() => { result.current.onGraphQuery('p'); });
    expect(enviados[enviados.length - 1]).toEqual({ t: 'graph-delete', id: 'g1' });
  });

  it('apagar outro grafo não mexe no aberto', () => {
    const { result } = montar();
    abrir(result);
    act(() => { result.current.onGraphDelete('g9'); });
    expect(result.current.graphOpenId).toBe('g1');
    expect(result.current.graphData).toBe(grafo);
  });

  it('log de build tem teto e o done sem ok vira erro', () => {
    const { result } = montar();
    act(() => { result.current.onGraphBuild('repo'); });
    expect(result.current.graphBuilding).toBe(true);
    act(() => { for (let i = 0; i < 260; i++) result.current.onMsg({ t: 'graph-build-progress', line: `l${i}` }); });
    expect(result.current.graphBuildLog.length).toBeLessThanOrEqual(201);
    expect(result.current.graphBuildLog[result.current.graphBuildLog.length - 1]).toBe('l259');
    act(() => { result.current.onMsg({ t: 'graph-build-done', ok: false }); });
    expect(result.current.graphBuilding).toBe(false);
    expect(result.current.graphBuildError).toBe('falha no build');
    act(() => { result.current.onClearBuildError(); });
    expect(result.current.graphBuildError).toBe(null);
  });

  // Build/abertura/consulta em voo quando o socket cai nunca recebem resposta:
  // sem este gancho o botão fica "construindo…" até o F5.
  it('reconexão destrava build, abertura e consulta em voo', () => {
    const { result, enviados } = montar();
    act(() => { result.current.onGraphBuild('repo'); result.current.onGraphOpen('g1'); });
    act(() => { result.current.onMsg({ t: 'graph-data', id: 'g1', graph: grafo }); result.current.onGraphQuery('p'); });
    act(() => { result.current.onGraphReconnect(); });
    expect(result.current.graphBuilding).toBe(false);
    expect(result.current.graphOpening).toBe(null);
    expect(result.current.graphQuerying).toBe(false);
    expect(result.current.graphBuildError).toContain('conexão caiu');
    expect(enviados[enviados.length - 1]).toEqual({ t: 'graph-list' });
  });

  it('reconexão sem build em voo não inventa erro', () => {
    const { result } = montar();
    act(() => { result.current.onGraphReconnect(); });
    expect(result.current.graphBuildError).toBe(null);
  });

  it('devolve false pro que não é dele', () => {
    const { result } = montar();
    expect(result.current.onMsg({ t: 'skills', items: [] })).toBe(false);
  });
});
