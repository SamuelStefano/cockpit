import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import type { LogEntry } from './useLivePreview';

const LEVEL_COLOR: Record<string, string> = {
  log: 'text-neutral-300',
  info: 'text-sky-300',
  warn: 'text-amber-300',
  error: 'text-red-400',
};

// Painel de console do preview: mostra o que o código rodando chamou via
// console.* (capturado no iframe). Rola pro fim a cada log novo — igual devtools.
export function ConsolePanel({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [logs.length]);

  return (
    <div className="border-t border-neutral-800 bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          <Icon name="terminal" size={11} /> console
          {logs.length > 0 && <span className="text-neutral-600">· {logs.length}</span>}
        </span>
        {logs.length > 0 && (
          <button onClick={onClear} title="Limpar console"
            className="rounded px-1.5 py-0.5 text-[10px] text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-400">
            limpar
          </button>
        )}
      </div>
      <div className="scroll-thin max-h-32 overflow-auto px-3 pb-1.5">
        {logs.length === 0 ? (
          <div className="py-1.5 font-mono text-[11px] text-neutral-600">nenhum log — chame console.log() no código</div>
        ) : (
          logs.map((l) => (
            <div key={l.n} className={`whitespace-pre-wrap break-words border-b border-neutral-900 py-0.5 font-mono text-[11.5px] leading-snug ${LEVEL_COLOR[l.level] ?? 'text-neutral-300'}`}>
              {l.text || ' '}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
