import { useState } from 'react';
import type { BoxInfo } from '../../../shared/boxes';
import { useBoxPeek } from '../../cockpit/useBoxPeek';
import { BoxHeader } from './BoxHeader';
import { PeekRow } from './PeekRow';

const NOTE = 'px-2 py-1 text-[12px] text-neutral-500';

// Collapsed by default: the peek socket only opens while the header is expanded.
export function OtherBoxSection({ box, onOpen }: { box: BoxInfo; onOpen: (box: string, sessionId: string) => void }) {
  const [open, setOpen] = useState(false);
  const peek = useBoxPeek(box.id, open && box.online);
  const busy = new Set(peek.busy);

  return (
    <section aria-label={box.label || box.id} className="space-y-0.5">
      <BoxHeader box={box} open={open} onToggle={() => setOpen((v) => !v)} count={peek.status === 'open' ? peek.sessions.length : undefined} />
      {open && (
        !box.online ? <p className={NOTE}>Máquina offline.</p>
          : peek.status === 'locked' ? <p className={NOTE}>Este aparelho não está cadastrado nesta máquina. Troque para ela para cadastrar.</p>
            : peek.status !== 'open' ? <p className={NOTE} role="status">Conectando…</p>
              : peek.sessions.length === 0 ? <p className={NOTE}>Nenhuma sessão.</p>
                : peek.sessions.map((s) => <PeekRow key={s.id} s={s} busy={busy.has(s.id)} onOpen={() => onOpen(box.id, s.id)} />)
      )}
    </section>
  );
}
