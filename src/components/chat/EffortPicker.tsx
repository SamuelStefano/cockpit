import type { Effort } from '../../../shared/protocol';

// Nível de pensamento (--effort) por sessão, igual ao seletor dos chats do Claude.
// Default 'low': sem effort explícito o CLI usa o default da conta (alto), que queima
// thinking tokens até num pedido simples — o maior driver de gasto do Deck.
const LEVELS: { id: Effort; label: string; hint: string }[] = [
  { id: 'low', label: 'Baixo', hint: 'pensa pouco — mais barato e rápido' },
  { id: 'medium', label: 'Médio', hint: 'equilíbrio entre custo e raciocínio' },
  { id: 'high', label: 'Alto', hint: 'pensa bastante — tarefas difíceis' },
  { id: 'xhigh', label: 'Muito alto', hint: 'raciocínio estendido — caro' },
  { id: 'max', label: 'Máximo', hint: 'pensamento máximo — mais caro' },
];

export function EffortPicker({ effort, setEffort, disabled }: {
  effort: Effort; setEffort: (e: Effort) => void; disabled: boolean;
}) {
  const sel = 'rounded-md border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[11px] font-medium text-neutral-300 outline-none transition hover:border-neutral-700 focus:border-orange-500/40 disabled:cursor-not-allowed disabled:opacity-50';
  const tag = 'text-[9px] font-semibold uppercase tracking-wide text-neutral-600';
  return (
    <label className="inline-flex items-center gap-1" title="Nível de pensamento desta sessão — quanto maior, mais tokens (e custo).">
      <span className={tag}>pensar</span>
      <select
        value={effort}
        disabled={disabled}
        onChange={(e) => setEffort(e.target.value as Effort)}
        className={sel}
      >
        {LEVELS.map((l) => <option key={l.id} value={l.id} title={l.hint}>{l.label}</option>)}
      </select>
    </label>
  );
}
