import { useState, useRef, useEffect, useMemo } from 'react';
import { Icon, ToggleChip, tokens } from '../primitives';
import type { SkillMeta } from '../../../shared/protocol';
import { PickerSheet } from './PickerSheet';
import { isInsidePickerSheet } from './picker-sheet-dom';

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
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node) && !isInsidePickerSheet(e.target)) setOpen(false); };
    // defaultPrevented: se outro handler já consumiu o Esc (parar turno, paleta
    // por cima), não fecha o picker junto no mesmo keypress.
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
    const onBubble = (e: KeyboardEvent) => { if (escape(e)) close(e); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onCapture, true);
    window.addEventListener('keydown', onBubble);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onCapture, true);
      window.removeEventListener('keydown', onBubble);
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
        <PickerSheet
          label="Escolher skills"
          query={q}
          setQuery={setQ}
          placeholder="Filtrar skills…"
          onClear={count > 0 ? () => setSelected([]) : null}
          onClose={() => setOpen(false)}
          footer="Nenhuma marcada = todas as skills ativas (padrão)."
        >
          {filtered.map((s) => {
            const on = selected.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                aria-pressed={on}
                title={s.description || undefined}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-neutral-800/60 ${tokens.focusRing}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition
                  ${on ? 'border-orange-500 bg-orange-500 text-neutral-950' : 'border-neutral-600'}`}>
                  {on && <Icon name="check" size={11} />}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[12.5px] font-medium ${on ? 'text-orange-200' : 'text-neutral-200'}`}>{s.name}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-3 text-[11.5px] text-neutral-500">Nenhuma skill encontrada.</p>
          )}
        </PickerSheet>
      )}
    </div>
  );
}
