import { useState } from 'react';
import { Icon, tokens } from '../primitives';
import type { IconName } from '../primitives/Icon';
import type { TriageAction } from '../../../shared/protocol';

// Selo da triagem sob a bolha do usuário (prompt enviado com o turno ocupado). O
// `desc` explica o veredicto em geral (o que a triagem faz); o `reason` do servidor
// explica por que ESTA mensagem caiu nele. O tooltip junta os dois.
const TRIAGE_META: Record<TriageAction, { icon: IconName; label: string; cls: string; desc: string }> = {
  wait: { icon: 'clock', label: 'na fila', cls: 'bg-amber-500/15 text-amber-300', desc: 'Enfileirado: roda assim que o turno atual terminar.' },
  answer: { icon: 'zap', label: 'resposta rápida', cls: 'bg-sky-500/15 text-sky-300', desc: 'Respondido à parte por um subagente, sem tocar o turno em andamento.' },
  priority: { icon: 'arrowUp', label: 'priorizado', cls: 'bg-rose-500/15 text-rose-300', desc: 'Urgente: o turno atual foi interrompido e este rodou na frente.' },
  merge: { icon: 'sparkles', label: 'juntado ao anterior', cls: 'bg-violet-500/15 text-violet-300', desc: 'Complementa o pedido anterior — somado ao turno em andamento.' },
};

export function TriageBadge({ action, reason }: { action: TriageAction; reason: string }) {
  const m = TRIAGE_META[action];
  const title = reason ? `${m.desc}\n\nPor quê: ${reason}` : m.desc;
  // The why lived only in a hover title: a phone never showed it. A tap opens it.
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls} ${tokens.focusRing}`}
        title={title}
      >
        <Icon name={m.icon} size={10} /> {m.label}
      </button>
      {open && <span className="max-w-72 text-right text-[10.5px] leading-snug text-neutral-500">{m.desc}{reason && <> Por quê: {reason}</>}</span>}
    </span>
  );
}
