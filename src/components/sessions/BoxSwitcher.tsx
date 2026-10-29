import { Button, Icon } from '../primitives';
import { useEscapeLayer } from '../primitives/useEscapeLayer';
import { boxLabel } from '../../cockpit/boxes-store';
import { AddBoxModal } from './AddBoxModal';
import { BoxDot } from './BoxDot';
import { useBoxSwitcher } from './useBoxSwitcher';
import { HealthBadge } from '../health/HealthBadge';

// `block` fills the phone drawer; `chip` is the quiet desktop footer control, whose menu opens upward.
const LOOK = {
  block: {
    wrap: 'relative mb-2',
    button: 'flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 text-left text-[12.5px] text-neutral-200 transition hover:border-neutral-700',
    label: 'min-w-0 flex-1 truncate',
    menu: 'inset-x-0 top-full mt-1',
  },
  chip: {
    wrap: 'relative',
    button: 'flex h-7 items-center gap-1.5 rounded-lg px-2 text-left text-[13px] text-neutral-500 transition hover:bg-neutral-800/60 hover:text-neutral-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40',
    label: 'sr-only',
    menu: 'bottom-full left-0 mb-1 w-64',
  },
} as const;

export function BoxSwitcher({ userId, variant = 'block' }: { userId?: string; variant?: keyof typeof LOOK }) {
  const s = useBoxSwitcher();
  useEscapeLayer(s.open, s.close);
  if (!s.visible) return null;
  const look = LOOK[variant];

  return (
    <div className={look.wrap}>
      <button
        type="button" onClick={() => s.setOpen(!s.open)} aria-haspopup="menu" aria-expanded={s.open} aria-label="Trocar de máquina"
        title={s.current ? `${boxLabel(s.current)} · ${s.current.online ? 'online' : 'offline'}` : undefined}
        className={look.button}
      >
        <BoxDot online={s.current?.online ?? false} />
        <span className={look.label}>{s.current ? boxLabel(s.current) : 'Máquina'}</span>
        {s.active && s.levelOf(s.active) !== 'ok' && <HealthBadge level={s.levelOf(s.active)} />}
        {variant === 'block' && <Icon name="chevronDown" size={14} className="shrink-0 text-neutral-500" />}
      </button>
      {s.open && (
        <div role="menu" className={`absolute ${look.menu} z-50 rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-xl shadow-black/40`}>
          {s.sorted.map((b) => (
            <div key={b.id} className="rounded-md px-1.5 py-1 hover:bg-neutral-800/60">
              {s.editingId === b.id ? (
                <input
                  autoFocus value={s.draft} maxLength={64} aria-label="Novo nome da máquina"
                  onChange={(e) => s.setDraft(e.target.value)} onBlur={s.commitEdit}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') { e.preventDefault(); s.commitEdit(); }
                    if (e.key === 'Escape') { e.stopPropagation(); s.cancelEdit(); }
                  }}
                  className="w-full rounded-md border border-orange-500/40 bg-neutral-950 px-1.5 py-0.5 text-[12.5px] text-neutral-100 outline-hidden"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <button type="button" role="menuitem" onClick={() => s.select(b.id)} className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left text-[12.5px] text-neutral-200">
                    <BoxDot online={b.online} />
                    <span className="min-w-0 flex-1 truncate">{boxLabel(b)}</span>
                    <HealthBadge level={s.levelOf(b.id)} />
                    {b.id === s.active && <Icon name="check" size={13} className="shrink-0 text-orange-400" />}
                  </button>
                  <button type="button" onClick={() => s.startEdit(b)} title="Renomear" aria-label={`Renomear ${boxLabel(b)}`} className="rounded-md p-1 text-neutral-500 hover:text-neutral-200 pointer-coarse:p-3">
                    <Icon name="pencil" size={13} />
                  </button>
                  <button type="button" onClick={() => s.askRevoke(b.id)} title="Remover" aria-label={`Remover ${boxLabel(b)}`} className="rounded-md p-1 text-neutral-500 hover:text-red-400 pointer-coarse:p-3">
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              )}
              {s.confirmId === b.id && (
                <div className="mt-1 space-y-1.5 border-t border-neutral-800 px-0.5 pt-1.5">
                  <p className="text-[11.5px] leading-snug text-neutral-400">
                    {b.id === s.active
                      ? 'Você está nesta máquina: remover desconecta o Deck dela.'
                      : 'A máquina deixa de aparecer no Deck e precisa ser pareada de novo.'}
                  </p>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="dangerSolid" onClick={() => s.revoke(b.id)}>Remover</Button>
                    <Button size="sm" variant="ghost" onClick={s.cancelRevoke}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="mt-1 border-t border-neutral-800 pt-1">
            <button type="button" role="menuitem" onClick={s.openHealth} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] text-neutral-300 hover:bg-neutral-800/60">
              <Icon name="shield" size={13} />
              Saúde da máquina
            </button>
            <button type="button" role="menuitem" onClick={s.startAdd} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] text-neutral-300 hover:bg-neutral-800/60">
              <Icon name="plus" size={13} />
              Adicionar máquina
            </button>
          </div>
        </div>
      )}
      {s.adding && <AddBoxModal onClose={s.stopAdd} userId={userId} />}
    </div>
  );
}
