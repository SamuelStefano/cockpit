import { useState } from 'react';
import { Icon, Button, Badge } from '../../components/primitives';
import type { GraphQueryState } from '../../useCockpit';

interface Props {
  querying: boolean;
  result: GraphQueryState | null;
  onQuery: (question: string) => void;
}

// Estima o custo "antes" (ler os arquivos crus) a partir dos arquivos citados na
// resposta — heurística: cada arquivo-fonte distinto ~ 1.500 tokens de leitura.
// Serve só pro contraste visual do ganho; o número honesto sai do `graphify
// benchmark`, que a UI não roda a cada query.
function estimateBefore(answer: string): number {
  const files = new Set(Array.from(answer.matchAll(/src=([^\s\]]+)/g), (m) => m[1]));
  return Math.max(files.size, 1) * 1500;
}

export function GraphQueryPanel({ querying, result, onQuery }: Props) {
  const [q, setQ] = useState('');
  const submit = () => { const t = q.trim(); if (t && !querying) onQuery(t); };

  const before = result ? estimateBefore(result.answer) : 0;
  const ratio = result && result.tokens ? before / result.tokens : 0;

  return (
    <div className="flex shrink-0 flex-col border-t border-neutral-800/80 bg-neutral-950">
      <div className="flex items-center gap-2 p-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 focus-within:border-orange-500/40">
          <Icon name="search" size={14} className="shrink-0 text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="pergunte ao grafo… (ex: como a autenticação funciona)"
            aria-label="Pergunta para o grafo"
            className="w-full bg-transparent text-[13px] text-neutral-200 placeholder-neutral-600 outline-none"
          />
        </div>
        <Button variant="primary" size="md" icon="send" loading={querying} disabled={!q.trim() || querying} onClick={submit}>
          consultar
        </Button>
      </div>

      {result && (
        <div className="max-h-56 overflow-y-auto border-t border-neutral-800/60 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="green">{result.tokens.toLocaleString('pt-BR')} tokens</Badge>
            {ratio > 1.2 && (
              <span className="text-[11px] text-neutral-500">
                vs ~<span className="text-neutral-300">{before.toLocaleString('pt-BR')}</span> lendo os arquivos crus
                <span className="ml-1 font-semibold text-green-400">≈ {ratio.toFixed(1)}x menos</span>
              </span>
            )}
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-neutral-300">{result.answer || '(sem resultado)'}</pre>
        </div>
      )}
    </div>
  );
}
