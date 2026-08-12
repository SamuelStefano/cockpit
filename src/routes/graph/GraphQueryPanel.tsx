import { useState } from 'react';
import { Button, Badge, Input } from '../../components/primitives';
import type { GraphQueryState } from '../../useCockpit';

type Budget = 'curta' | 'média' | 'longa';
const BUDGETS: Record<Budget, number> = { curta: 600, 'média': 2000, longa: 6000 };

interface Props {
  querying: boolean;
  result: GraphQueryState | null;
  history: GraphQueryState[];
  onQuery: (question: string, budget?: number) => void;
}

// Estima o custo "antes" (ler os arquivos crus) a partir dos arquivos citados na
// resposta — heurística rotulada como estimativa. O número honesto por-grafo sai
// do `graphify benchmark` (badge no card da lista).
function estimateBefore(answer: string): number {
  const files = new Set(Array.from(answer.matchAll(/src=([^\s\]]+)/g), (m) => m[1]));
  return Math.max(files.size, 1) * 1500;
}

export function GraphQueryPanel({ querying, result, history, onQuery }: Props) {
  const [q, setQ] = useState('');
  const [budget, setBudget] = useState<Budget>('média');
  const run = (question: string) => { const t = question.trim(); if (t && !querying) onQuery(t, BUDGETS[budget]); };
  const submit = () => { run(q); };

  const before = result && !result.miss ? estimateBefore(result.answer) : 0;
  const ratio = result && !result.miss && result.tokens ? before / result.tokens : 0;

  return (
    <div className="flex shrink-0 flex-col border-t border-neutral-800/80 bg-neutral-950">
      <div className="flex items-center gap-2 p-3">
        <div className="flex-1">
          <Input
            icon="search" value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="pergunte com termos do código… (ex: auth token session)"
            aria-label="Pergunta para o grafo"
          />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-neutral-800">
          {(Object.keys(BUDGETS) as Budget[]).map((b) => (
            <button key={b} onClick={() => setBudget(b)}
              className={`px-2 py-2 font-mono text-[11px] transition-colors ${budget === b ? 'bg-orange-500/15 text-orange-200' : 'text-neutral-500 hover:text-neutral-300'}`}>
              {b}
            </button>
          ))}
        </div>
        <Button variant="primary" size="md" icon="send" loading={querying} disabled={!q.trim() || querying} onClick={submit}>
          consultar
        </Button>
      </div>

      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-1">
          <span className="text-[10px] uppercase tracking-wide text-neutral-600">recentes</span>
          {history.map((h) => (
            <button key={h.question} onClick={() => { setQ(h.question); run(h.question); }}
              className="max-w-[220px] truncate rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[10.5px] text-neutral-400 hover:text-neutral-200">
              {h.question}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="max-h-56 overflow-y-auto border-t border-neutral-800/60 px-4 py-3">
          {result.miss ? (
            <div>
              <div className="text-[12.5px] text-neutral-400">nenhum nó casou com esses termos</div>
              <div className="mt-1 text-[11px] text-neutral-600">use identificadores e nomes de arquivo do código (ex: authorize, useCockpit, dispatch)</div>
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone="green">{result.tokens.toLocaleString('pt-BR')} tokens</Badge>
                {ratio > 1.2 && (
                  <span className="text-[11px] text-neutral-500">
                    vs ~<span className="text-neutral-300">{before.toLocaleString('pt-BR')}</span> lendo os arquivos crus (estimativa)
                    <span className="ml-1 font-semibold text-green-400">≈ {ratio.toFixed(1)}x menos</span>
                  </span>
                )}
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-neutral-300">{result.answer || '(sem resultado)'}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
