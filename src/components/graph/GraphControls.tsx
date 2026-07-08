import { Icon, Button } from '../primitives';
import type { ColorMode } from './useForceGraph';

interface Props {
  query: string;
  onQuery: (q: string) => void;
  matchCount: number | null; // null = sem busca ativa
  colorMode: ColorMode;
  onColorMode: (m: ColorMode) => void;
  showColorToggle: boolean;
  onReset: () => void;
}

export function GraphControls({ query, onQuery, matchCount, colorMode, onColorMode, showColorToggle, onReset }: Props) {
  return (
    <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/95 px-2.5 py-1.5 shadow-lg backdrop-blur focus-within:border-orange-500/40">
        <Icon name="search" size={13} className="shrink-0 text-neutral-500" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="buscar nó…"
          aria-label="Buscar nó no grafo"
          className="w-40 bg-transparent font-mono text-[12px] text-neutral-200 placeholder-neutral-600 outline-none"
        />
        {matchCount !== null && (
          <span className={`shrink-0 font-mono text-[10.5px] ${matchCount ? 'text-orange-300' : 'text-neutral-600'}`}>{matchCount}</span>
        )}
      </div>

      {showColorToggle && (
        <div className="flex overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/95 shadow-lg backdrop-blur">
          {(['repo', 'community'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onColorMode(m)}
              className={`px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                colorMode === m ? 'bg-orange-500/15 text-orange-200' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {m === 'repo' ? 'por app' : 'por comunidade'}
            </button>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" icon="rotate" onClick={onReset}>enquadrar</Button>
    </div>
  );
}
