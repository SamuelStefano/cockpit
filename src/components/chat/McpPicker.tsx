import { useState, useRef, useEffect, useMemo } from 'react';
import { Icon, ToggleChip, tokens } from '../primitives';
import { ALL_MCPS, isAllMcps } from '../../../shared/mcp';
import { PickerSheet } from './PickerSheet';
import { isInsidePickerSheet } from './picker-sheet-dom';
import { escapeLayerOpen } from '../primitives/useEscapeLayer';

// Seletor dos MCP servers ativos POR PROMPT. AO CONTRÁRIO das skills: vazio =
// NENHUM MCP (default fail-CLOSED). Cada server adiciona ~5-20k tokens de
// definições de tool POR chamada — carregar todos em todo chat era a maior fonte
// de gasto extra vs o terminal. O backend spawna com --strict-mcp-config e só
// inclui os marcados. Não desabilita com run em curso: muda só o próximo envio.
//
// "Permitir todos" guarda o sentinel '*' em vez da lista: quem expande é o
// servidor, no envio, contra o ~/.claude.json do momento — MCP adicionado depois
// já vale sem a aba precisar recarregar.
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
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node) && !isInsidePickerSheet(e.target)) setOpen(false); };
    const close = (e: KeyboardEvent) => { e.preventDefault(); setOpen(false); };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && !e.isComposing;
    // Capture, but only for Esc aimed at the picker (focus in it, its portaled
    // sheet, or nowhere): inside the mobile settings sheet the sheet's own
    // listener was registered first and closed both. Esc aimed elsewhere (the ⌘K
    // palette on top, the composer's Esc-to-stop) is left to them; the bubble
    // listener then closes the picker only if nobody consumed it.
    const onCapture = (e: KeyboardEvent) => {
      const t = e.target as Node | null;
      const aimed = !t || t === document.body || t === document.documentElement || !!wrapRef.current?.contains(t) || isInsidePickerSheet(t);
      if (aimed && escape(e)) close(e);
    };
    // A dialog opened on top (escape stack) owns an Esc that was not aimed here.
    const onBubble = (e: KeyboardEvent) => { if (escape(e) && !escapeLayerOpen()) close(e); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onCapture, true);
    window.addEventListener('keydown', onBubble);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onCapture, true);
      window.removeEventListener('keydown', onBubble);
    };
  }, [open]);

  const known = useMemo(() => new Set(servers), [servers]);
  const all = isAllMcps(selected);
  const liveCount = all ? servers.length : selected.filter((id) => known.has(id)).length;

  // Desmarcar um item com "todos" ligado materializa a lista (todos menos ele) —
  // sair do modo todos apagando a escolha inteira seria surpresa.
  const toggle = (id: string) => {
    if (all) { setSelected(servers.filter((x) => x !== id)); return; }
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const toggleAll = () => setSelected(all ? [] : [ALL_MCPS]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return servers;
    return servers.filter((s) => s.toLowerCase().includes(needle));
  }, [servers, q]);

  const empty = servers.length === 0;
  // `all` conta como ligado mesmo antes da lista de servers chegar do backend —
  // o sentinel já vai no envio e quem expande é o servidor.
  const active = all || liveCount > 0;

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <ToggleChip
        on={active}
        icon="command"
        onClick={() => setOpen((o) => !o)}
        title={all ? `Todos os MCPs liberados (${servers.length}) neste prompt` : active ? `${liveCount} MCP ativo(s) neste prompt` : 'MCP desligado (economiza ~tokens). Clique pra ligar algum nesta sessão.'}
      >
        MCP
        {active && <span className="rounded-sm bg-orange-500/30 px-1 text-[10px] tabular-nums text-orange-200">{liveCount}</span>}
        <Icon name="chevronDown" size={11} className={open ? 'rotate-180 transition' : 'transition'} />
      </ToggleChip>

      {open && (
        <PickerSheet
          label="Escolher MCP servers"
          query={q}
          setQuery={setQ}
          placeholder="Filtrar MCP…"
          onClear={!empty && liveCount > 0 ? () => setSelected([]) : null}
          onClose={() => setOpen(false)}
          footer={all
            ? `Todos ligados (${servers.length}) — inclui MCP que você adicionar depois. Custa ~5-20k tokens por server, por mensagem.`
            : 'Vazio = nenhum MCP (mais barato). Ligue só o que esta sessão precisa.'}
        >
          {!empty && (
            <button
              onClick={toggleAll}
              aria-pressed={all}
              className={`flex w-full items-center gap-2.5 border-b border-neutral-800/70 px-3 py-2 text-left transition hover:bg-neutral-800/60 ${tokens.focusRing}`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition
                ${all ? 'border-orange-500 bg-orange-500 text-neutral-950' : 'border-neutral-600'}`}>
                {all && <Icon name="check" size={11} />}
              </span>
              <span className={`min-w-0 flex-1 truncate text-[12.5px] font-semibold ${all ? 'text-orange-200' : 'text-neutral-200'}`}>
                Permitir todos os MCPs
              </span>
            </button>
          )}
          {filtered.map((s) => {
            const on = all || selected.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggle(s)}
                aria-pressed={on}
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
            <p className="px-3 py-3 text-[11.5px] text-neutral-500">
              {empty ? 'Nenhum MCP configurado nesta máquina. Adicione em Admin → MCP (ou no ~/.claude.json) e ele aparece aqui.' : 'Nenhum MCP encontrado.'}
            </p>
          )}
        </PickerSheet>
      )}
    </div>
  );
}
