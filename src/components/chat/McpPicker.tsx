import { useState, useRef, useEffect, useMemo } from 'react';
import { Icon, tokens } from '../primitives';

// Seletor dos MCP servers ativos POR PROMPT. AO CONTRÁRIO das skills: vazio =
// NENHUM MCP (default fail-CLOSED). Cada server adiciona ~5-20k tokens de
// definições de tool POR chamada — carregar todos em todo chat era a maior fonte
// de gasto extra vs o terminal. O backend spawna com --strict-mcp-config e só
// inclui os marcados. Não desabilita com run em curso: muda só o próximo envio.
export function McpPicker({ servers, selected, setSelected }: {
  servers: string[];
  selected: string[];
  setSelected: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !e.isComposing) { e.preventDefault(); setOpen(false); } };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const known = useMemo(() => new Set(servers), [servers]);
  const liveCount = selected.filter((id) => known.has(id)).length;

  const toggle = (id: string) => {
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return servers;
    return servers.filter((s) => s.toLowerCase().includes(needle));
  }, [servers, q]);

  if (servers.length === 0) return null;
  const active = liveCount > 0;

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={active ? `${liveCount} MCP ativo(s) neste prompt` : 'MCP desligado (economiza ~tokens). Clique pra ligar algum nesta sessão.'}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${tokens.focusRing}
          ${active
            ? 'border-orange-500/50 bg-orange-500/15 text-orange-300 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.4)]'
            : 'border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-300'}`}
      >
        <Icon name="command" size={12} />
        MCP
        {active && <span className="rounded bg-orange-500/30 px-1 text-[10px] tabular-nums text-orange-200">{liveCount}</span>}
        <Icon name="chevronDown" size={11} className={open ? 'rotate-180 transition' : 'transition'} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40 sm:hidden" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Escolher MCP servers" className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] rounded-t-2xl border border-neutral-700 bg-neutral-900 shadow-xl shadow-black/50 sm:absolute sm:bottom-full sm:left-0 sm:inset-x-auto sm:mb-2 sm:max-h-80 sm:w-72 sm:rounded-lg">
            <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
              <Icon name="search" size={13} className="shrink-0 text-neutral-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar MCP…"
                aria-label="Filtrar MCP servers"
                autoFocus
                className="w-full bg-transparent text-[12.5px] text-neutral-100 placeholder-neutral-600 outline-none"
              />
              {liveCount > 0 && (
                <button
                  onClick={() => setSelected([])}
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300 ${tokens.focusRing}`}
                >
                  limpar
                </button>
              )}
            </div>
            <div className="scroll-thin max-h-[calc(70vh-92px)] overscroll-contain overflow-auto py-1 sm:max-h-56">
              {filtered.map((s) => {
                const on = selected.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggle(s)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-neutral-800/60 ${tokens.focusRing}`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition
                      ${on ? 'border-orange-500 bg-orange-500 text-neutral-950' : 'border-neutral-600'}`}>
                      {on && <Icon name="check" size={11} />}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-[12.5px] font-medium ${on ? 'text-orange-200' : 'text-neutral-200'}`}>{s}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-3 text-[11.5px] text-neutral-500">Nenhum MCP encontrado.</p>
              )}
            </div>
            <p className="border-t border-neutral-800 px-3 py-2 text-[10.5px] leading-snug text-neutral-500">
              Vazio = nenhum MCP (mais barato). Ligue só o que esta sessão precisa.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
