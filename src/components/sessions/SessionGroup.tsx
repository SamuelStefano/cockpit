import type { ReactNode } from 'react';
import { SessionGroupHeader } from './SessionGroupHeader';
import { RUNNING_LABEL, WAITING_LABEL } from './group-by-recency';

// Grupo de ESTADO (rodando / aguardando você) não é um recorte de tempo como
// "Hoje": é fila acionável. Com o mesmo cabeçalho-hairline dos outros ele
// disputava atenção de igual pra igual com os rótulos de data e a fila sumia no
// meio da lista. Aqui vira um bloco tingido, com começo e fim visíveis.
const BLOCK: Record<string, string> = {
  [RUNNING_LABEL]: 'border-green-500/20 bg-green-500/6',
  [WAITING_LABEL]: 'border-violet-500/25 bg-violet-500/8',
};

export function SessionGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const block = BLOCK[label];
  if (!block) {
    return (
      <div className="space-y-1.5">
        <SessionGroupHeader label={label} count={count} />
        {children}
      </div>
    );
  }
  return (
    <section aria-label={label} className={`space-y-1 rounded-xl border p-1.5 ${block}`}>
      <SessionGroupHeader label={label} count={count} inset />
      {children}
    </section>
  );
}
