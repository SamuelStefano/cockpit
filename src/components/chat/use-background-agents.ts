import { useEffect, useRef, useState } from 'react';
import type { BgAgent } from '../../../shared/protocol';

// Quanto tempo um agente concluído fica no "✓ done" antes de sumir.
const DONE_LINGER_MS = 4000;

export interface ViewAgent extends BgAgent {
  elapsedMs: number; // tempo decorrido tickando no cliente (não depende de novo evento)
}

// Lógica do indicador de agentes de fundo: tica o cronômetro client-side a partir
// de startedAt e mantém um agente concluído visível por alguns segundos (estado
// "done") antes de removê-lo, mesmo depois que o backend para de reportá-lo.
export function useBackgroundAgents(incoming: BgAgent[] | undefined): ViewAgent[] {
  const agents = incoming ?? EMPTY;
  // Snapshot persistente por id: o backend deixa de listar um agente concluído no
  // tick seguinte; guardamos o último estado pra exibir o "done" no linger.
  const linger = useRef<Map<string, { agent: BgAgent; until: number }>>(new Map());
  const [, force] = useState(0);

  // Reconciliação: ids vivos vêm do backend; concluídos/sumidos entram no linger.
  const prev = useRef<Map<string, BgAgent>>(new Map());
  const live = new Map<string, BgAgent>();
  for (const a of agents) live.set(a.id, a);
  const now = Date.now();
  for (const [id, a] of prev.current) {
    if (!live.has(id) && a.status === 'running') {
      // Sumiu sem virar done explícito: trata como done pra fechar o ciclo na UI.
      linger.current.set(id, { agent: { ...a, status: 'done' }, until: now + DONE_LINGER_MS });
    }
  }
  for (const a of agents) {
    if (a.status === 'done' || a.status === 'failed') {
      if (!linger.current.has(a.id)) linger.current.set(a.id, { agent: a, until: now + DONE_LINGER_MS });
    } else {
      linger.current.delete(a.id);
    }
  }
  prev.current = live;

  // Tick de 1s enquanto há QUALQUER agente visível (vivo ou em linger) pra o
  // cronômetro avançar e o linger expirar sem novo evento do servidor.
  const hasVisible = agents.length > 0 || linger.current.size > 0;
  useEffect(() => {
    if (!hasVisible) return;
    const id = setInterval(() => force((n) => (n + 1) % 1e6), 1000);
    return () => clearInterval(id);
  }, [hasVisible]);

  const out: ViewAgent[] = [];
  const t = Date.now();
  for (const a of agents) {
    if (a.status === 'running') out.push({ ...a, elapsedMs: Math.max(0, t - a.startedAt) });
  }
  for (const [id, { agent, until }] of linger.current) {
    if (t >= until) { linger.current.delete(id); continue; }
    if (live.get(id)?.status === 'running') continue; // ainda rodando: já listado acima
    out.push({ ...agent, elapsedMs: agent.durationMs });
  }
  return out;
}

const EMPTY: BgAgent[] = [];
