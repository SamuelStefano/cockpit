import { useEffect, useState } from 'react';
import { Badge, Button, Icon } from '../components/primitives';
import type { AccountSummary } from '../../shared/protocol';
import { AdminConfirm } from './AdminConfirm';

// Gestão de contas do painel admin (T3). Lista todos os usuários (root/admin veem)
// e liga/desliga o flag admin (só root concede — o relay reaplica o gate). No
// loopback isto fica escondido (sem Supabase, não há contas).

interface AdminAccountsProps {
  accounts: AccountSummary[];
  onAccountsList: () => void;
  onSetAdmin: (accountId: string, admin: boolean) => void;
  canGrant: boolean; // root → pode alternar admin; admin → só lê
}

export function AdminAccounts({ accounts, onAccountsList, onSetAdmin, canGrant }: AdminAccountsProps) {
  useEffect(() => { onAccountsList(); }, [onAccountsList]);
  const [pending, setPending] = useState<AccountSummary | null>(null);

  const runPending = () => {
    if (!pending) return;
    onSetAdmin(pending.id, !pending.isAdmin);
    setPending(null);
  };

  return (
    <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          <Icon name="user" size={12} /> Contas <span className="text-neutral-600">· {accounts.length}</span>
        </h2>
        <Button variant="secondary" size="sm" icon="rotate" title="Atualizar contas" className="ml-auto" onClick={onAccountsList}>
          Atualizar
        </Button>
      </div>

      {accounts.length === 0 ? (
        <span className="text-[12px] text-neutral-600">nenhuma conta</span>
      ) : (
        <ul className="divide-y divide-neutral-800/70">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${a.agentOnline ? 'bg-emerald-400' : 'bg-neutral-700'}`} title={a.agentOnline ? 'VPS online' : 'VPS offline'} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-200">{a.email}</span>
              {a.isAdmin && <Badge tone="orange">admin</Badge>}
              {canGrant ? (
                <Button variant="secondary" size="sm" onClick={() => setPending(a)}>
                  {a.isAdmin ? 'Remover admin' : 'Tornar admin'}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!canGrant && (
        <p className="mt-3 text-[11px] text-neutral-600">Só o root concede/revoga admin.</p>
      )}

      {pending && (
        <AdminConfirm
          heading={pending.isAdmin ? 'Remover admin?' : 'Tornar admin?'}
          icon="shield"
          tone={pending.isAdmin ? 'danger' : 'accent'}
          cta={pending.isAdmin ? 'Remover' : 'Tornar admin'}
          body={pending.isAdmin
            ? <>A conta <span className="font-mono text-neutral-200">{pending.email}</span> perde acesso ao painel admin e às ações sensíveis.</>
            : <>A conta <span className="font-mono text-neutral-200">{pending.email}</span> ganha acesso ao painel admin e às ações de host.</>}
          onConfirm={runPending}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
