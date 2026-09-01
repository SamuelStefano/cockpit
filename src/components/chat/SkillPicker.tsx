import { useState, useRef, useEffect, useMemo } from 'react';
import { Icon, ToggleChip, tokens } from '../primitives';
import type { SkillMeta } from '../../../shared/protocol';

// Seletor das skills ativas POR PROMPT. Multi-select num popover (bottom-sheet no
// mobile). Vazio = todas ativas (default fail-open): o backend só NEGA as não
// marcadas (--disallowedTools Skill(id)); marcar uma já restringe a esse conjunto.
// Não desabilita com run em curso: muda só o próximo envio.
export function SkillPicker({ skills, selected, setSelected }: {
  skills: SkillMeta[];
  selected: string[];
  setSelected: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora (desktop; no mobile o backdrop cobre isso) e com Esc —
  // todos os outros overlays fecham com Esc, este era o único que não.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    // defaultPrevented: se outro handler já consumiu o Esc (parar turno, paleta
    // por cima), não fecha o picker junto no mesmo keypress.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !e.isComposing) { e.preventDefault(); setOpen(false); } };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = selected.length;
  // Sanidade: ignora ids selecionados que sumiram do disco (skill removida).
  const known = useMemo(() => new Set(skills.map((s) => s.id)), [skills]);
  const liveCount = selected.filter((id) => known.has(id)).length;

  const toggle = (id: string) => {
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return skills;
    return skills.filter((s) => s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle));
  }, [skills, q]);

  if (skills.length === 0) return null;
  const active = liveCount > 0;

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <ToggleChip
        on={active}
        icon="sparkles"
        onClick={() => setOpen((o) => !o)}
        title={active ? `${liveCount} skill(s) ativas neste prompt` : 'Escolher quais skills usar (vazio = todas)'}
      >
        skills
        {active && <span className="rounded-sm bg-orange-500/30 px-1 text-[10px] tabular-nums text-orange-200">{liveCount}</span>}
        <Icon name="chevronDown" size={11} className={open ? 'rotate-180 transition' : 'transition'} />
      </ToggleChip>

      {open && (
        <>
          {/* Backdrop só no mobile (bottom-sheet); no desktop o clique-fora resolve. */}
          <div className="fixed inset-0 z-30 bg-black/40 sm:hidden" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Escolher skills" className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] rounded-t-2xl border border-neutral-700 bg-neutral-900 shadow-xl shadow-black/50 sm:absolute sm:bottom-full sm:left-0 sm:inset-x-auto sm:mb-2 sm:max-h-80 sm:w-72 sm:rounded-lg">
            <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
              <Icon name="search" size={13} className="shrink-0 text-neutral-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar skills…"
                aria-label="Filtrar skills"
                autoFocus
                className="w-full bg-transparent text-[12.5px] text-neutral-100 placeholder-neutral-600 outline-hidden"
              />
              {count > 0 && (
                <button
                  onClick={() => setSelected([])}
                  className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300 ${tokens.focusRing}`}
                >
                  limpar
                </button>
              )}
            </div>
            <div className="scroll-thin max-h-[calc(70vh-92px)] overscroll-contain overflow-auto py-1 sm:max-h-56">
              {filtered.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-neutral-800/60 ${tokens.focusRing}`}
                  >
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition
                      ${on ? 'border-orange-500 bg-orange-500 text-neutral-950' : 'border-neutral-600'}`}>
                      {on && <Icon name="check" size={11} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[12.5px] font-medium ${on ? 'text-orange-200' : 'text-neutral-200'}`}>{s.name}</span>
                      {s.description && <span className="block truncate text-[10.5px] text-neutral-500">{s.description}</span>}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-3 text-[11.5px] text-neutral-500">Nenhuma skill encontrada.</p>
              )}
            </div>
            <p className="border-t border-neutral-800 px-3 py-2 text-[10.5px] leading-snug text-neutral-500">
              Nenhuma marcada = todas as skills ativas (padrão).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
