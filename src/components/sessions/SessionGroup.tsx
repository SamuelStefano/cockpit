import type { ReactNode } from 'react';
import { SessionGroupHeader } from './SessionGroupHeader';
import { RUNNING_LABEL, WAITING_LABEL } from './group-by-recency';

// Grupo de ESTADO (rodando / aguardando você) é fila acionável, não recorte de
// tempo. Em vez de uma caixa tingida (que brigava com o aro do card ativo e
// pesava a lista), o grupo ganha só um fio colorido à esquerda: a cor diz o
// estado, o cabeçalho diz o nome, e os cards seguem iguais aos demais.
const RULE: Record<string, string> = {
  [RUNNING_LABEL]: 'border-green-400/50',
  [WAITING_LABEL]: 'border-violet-400/50',
};

export function isStateGroup(label: string): boolean {
  return label in RULE;
}

export function SessionGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const rule = RULE[label];
  if (!rule) {
    return (
      <div className="space-y-1.5">
        <SessionGroupHeader label={label} count={count} />
        {children}
      </div>
    );
  }
  return (
    <section aria-label={label} className={`space-y-1.5 border-l-2 pl-2 ${rule}`}>
      <SessionGroupHeader label={label} count={count} inset />
      {children}
    </section>
  );
}
