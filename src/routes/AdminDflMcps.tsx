import { useEffect } from 'react';
import { Button, EmptyState, Icon } from '../components/primitives';
import type { DflMcps } from '../cockpit/useDflMcps';
import type { TermApi } from '../cockpit/useTerminals';
import { AdminDflMcpRow } from './AdminDflMcpRow';
import { AgentTerminal } from './AgentTerminal';
import { useDflMcpLogin } from './useDflMcpLogin';
import { useDflPanelOpen } from './useDflPanelOpen';

interface AdminDflMcpsProps {
  api: Pick<DflMcps, 'dflMcps' | 'dflMcpsBusy' | 'onDflMcpsGet' | 'onDflMcpsAdd'>;
  term: TermApi;
}

export function AdminDflMcps({ api, term }: AdminDflMcpsProps) {
  const { dflMcps, dflMcpsBusy, onDflMcpsGet, onDflMcpsAdd } = api;
  const { terminal, login } = useDflMcpLogin(term, onDflMcpsGet);
  useEffect(() => { onDflMcpsGet(); }, [onDflMcpsGet]);

  const { open, show } = useDflPanelOpen(dflMcps);
  const missing = dflMcps?.hosts.filter((h) => h.status === 'missing').length ?? 0;
  if (!open) {
    return (
      <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
        <p className="text-[13px] text-neutral-500">Trabalha na DevFellowship? Os servidores MCP da DFL ficam aqui.</p>
        <Button variant="ghost" size="sm" icon="link" onClick={show}>Mostrar MCPs da DFL</Button>
      </div>
    );
  }
  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-400">
            <Icon name="link" size={13} /> MCPs DFL
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon="rotate" disabled={dflMcpsBusy} onClick={onDflMcpsGet}>Atualizar</Button>
            <Button variant="primary" size="sm" icon="plus" loading={dflMcpsBusy} disabled={missing === 0} onClick={() => onDflMcpsAdd()}>
              Adicionar todos
            </Button>
          </div>
        </div>
        <p className="mb-2 text-[13px] text-neutral-500">
          Abra o link no seu navegador, entre, e quando a página falhar copie a URL inteira (localhost…) e cole no terminal.
        </p>
        {dflMcps?.source === 'fallback' && (
          <p className="mb-2 text-[12px] text-yellow-400">Lista da DFL indisponível agora: mostrando a lista embutida.</p>
        )}
        {dflMcps?.error && <p className="mb-2 text-[12px] text-red-400">{dflMcps.error}</p>}
        {!dflMcps ? (
          <EmptyState icon="link" title="Lendo MCPs…" description="Checar o status de cada servidor leva alguns segundos." />
        ) : (
          <ul className="divide-y divide-neutral-800/70">
            {dflMcps.hosts.map((h) => <AdminDflMcpRow key={h.host} host={h} canLogin={!dflMcpsBusy} onLogin={login} />)}
          </ul>
        )}
      </div>
      <AgentTerminal api={terminal} term={term} name="MCPs DFL" />
    </div>
  );
}
