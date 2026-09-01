import { useCallback, useRef, useState } from 'react';
import type { ClientMsg, GraphData, GraphMeta, ServerMsg } from '../../shared/protocol';

export interface GraphQueryState { question: string; answer: string; tokens: number; miss: boolean }
export type GraphNodeOp = 'explain' | 'affected' | 'path';

export interface Graphs {
  graphs: GraphMeta[];
  graphsLoaded: boolean;
  graphOpenId: string | null;
  graphOpening: string | null;
  graphData: GraphData | null;
  graphBuilding: boolean;
  graphBuildLog: string[];
  graphBuildError: string | null;
  graphQuerying: boolean;
  graphQueryResult: GraphQueryState | null;
  graphQueryHistory: GraphQueryState[];
  onGraphList: () => void;
  onGraphOpen: (id: string) => void;
  onGraphBuild: (repo: string) => void;
  onClearBuildError: () => void;
  onGraphDelete: (id: string) => void;
  onGraphQuery: (question: string, budget?: number) => void;
  onGraphNodeOp: (op: GraphNodeOp, a: string, b?: string) => void;
  onGraphReconnect: () => void;
  onMsg: (msg: ServerMsg) => boolean;
}

const LOG_CAP = 200;
const HISTORY_CAP = 8;

export function useGraphs(send: (m: ClientMsg) => boolean): Graphs {
  const [graphs, setGraphs] = useState<GraphMeta[]>([]);
  const [graphsLoaded, setGraphsLoaded] = useState(false);
  const [graphOpenId, setGraphOpenId] = useState<string | null>(null);
  const [graphOpening, setGraphOpening] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [graphBuilding, setGraphBuilding] = useState(false);
  const [graphBuildLog, setGraphBuildLog] = useState<string[]>([]);
  const [graphBuildError, setGraphBuildError] = useState<string | null>(null);
  const [graphQuerying, setGraphQuerying] = useState(false);
  const [graphQueryResult, setGraphQueryResult] = useState<GraphQueryState | null>(null);
  const [graphQueryHistory, setGraphQueryHistory] = useState<GraphQueryState[]>([]);
  // Espelho síncrono: onGraphQuery/onGraphNodeOp dependiam do state, então cada
  // abertura de grafo recriava os dois callbacks e remontava quem os recebe.
  const openIdRef = useRef<string | null>(null);

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'graphs':
        setGraphs(msg.items);
        setGraphsLoaded(true);
        return true;
      case 'graph-data':
        openIdRef.current = msg.id;
        setGraphOpenId(msg.id);
        setGraphOpening((cur) => (cur === msg.id ? null : cur));
        setGraphData(msg.graph);
        setGraphQueryResult(null); // resposta velha não vale pro grafo novo
        setGraphQueryHistory([]);  // histórico é por-grafo
        return true;
      case 'graph-query-result': {
        const r = { question: msg.question, answer: msg.answer, tokens: msg.tokens, miss: msg.miss };
        setGraphQueryResult(r);
        setGraphQuerying(false);
        // histórico só de consultas que renderam algo (não-miss); dedup por pergunta.
        if (!r.miss) setGraphQueryHistory((prev) => [r, ...prev.filter((h) => h.question !== r.question)].slice(0, HISTORY_CAP));
        return true;
      }
      case 'graph-build-progress':
        setGraphBuildLog((prev) => [...prev.slice(-LOG_CAP), msg.line]);
        return true;
      case 'graph-build-done':
        setGraphBuilding(false);
        if (!msg.ok) setGraphBuildError(msg.error ?? 'falha no build');
        return true;
      default:
        return false;
    }
  }, []);

  return {
    graphs,
    graphsLoaded,
    graphOpenId,
    graphOpening,
    graphData,
    graphBuilding,
    graphBuildLog,
    graphBuildError,
    graphQuerying,
    graphQueryResult,
    graphQueryHistory,
    onGraphList: useCallback(() => { send({ t: 'graph-list' }); }, [send]),
    onGraphOpen: useCallback((id: string) => {
      setGraphQueryResult(null);
      setGraphOpening(id);
      send({ t: 'graph-open', id });
    }, [send]),
    onGraphBuild: useCallback((repo: string) => {
      setGraphBuildLog([]); setGraphBuildError(null); setGraphBuilding(true);
      send({ t: 'graph-build', repo });
    }, [send]),
    onClearBuildError: useCallback(() => setGraphBuildError(null), []),
    onGraphDelete: useCallback((id: string) => {
      if (openIdRef.current === id) {
        openIdRef.current = null;
        setGraphOpenId(null);
        setGraphData(null);
      }
      send({ t: 'graph-delete', id });
    }, [send]),
    onGraphQuery: useCallback((question: string, budget?: number) => {
      const id = openIdRef.current;
      if (!id) return;
      setGraphQuerying(true);
      send({ t: 'graph-query', id, question, budget });
    }, [send]),
    onGraphNodeOp: useCallback((op: GraphNodeOp, a: string, b?: string) => {
      const id = openIdRef.current;
      if (!id) return;
      setGraphQuerying(true);
      send({ t: 'graph-node-op', id, op, a, b });
    }, [send]),
    // Build/abertura em voo quando o socket caiu nunca recebem o 'done' — o botão
    // ficaria "construindo…" pra sempre. Destrava e reconcilia via lista.
    onGraphReconnect: useCallback(() => {
      setGraphBuilding((b) => {
        if (b) { setGraphBuildError('conexão caiu durante o build — verifique a lista'); send({ t: 'graph-list' }); }
        return false;
      });
      setGraphOpening(null);
      // Consulta em voo tem o mesmo furo: sem o result o painel fica "consultando…".
      setGraphQuerying(false);
    }, [send]),
    onMsg,
  };
}
