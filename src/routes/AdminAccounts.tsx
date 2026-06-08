import { useEffect } from 'react';
import { Icon } from '../components/primitives';
import type { AccountSummary } from '../../shared/protocol';

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

  return (
    <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          <Icon name="user" size={12} /> Contas <span className="text-neutral-600">· {accounts.length}</span>
        </h2>
        <button
          onClick={onAccountsList}
          title="Atualizar contas"
          className="ml-auto flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-[11px] text-neutral-300 transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
        >
          <Icon name="rotate" size={11} /> Atualizar
        </button>
      </div>

      {accounts.length === 0 ? (
        <span className="text-[12px] text-neutral-600">nenhuma conta</span>
      ) : (
        <ul className="divide-y divide-neutral-800/70">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${a.agentOnline ? 'bg-emerald-400' : 'bg-neutral-700'}`} title={a.agentOnline ? 'VPS online' : 'VPS offline'} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-200">{a.email}</span>
              {a.isAdmin && (
                <span className="rounded-md border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-orange-200/90">admin</span>
              )}
              {canGrant ? (
                <button
                  onClick={() => onSetAdmin(a.id, !a.isAdmin)}
                  className="rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-[11px] text-neutral-300 transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                >
                  {a.isAdmin ? 'Remover admin' : 'Tornar admin'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!canGrant && (
        <p className="mt-3 text-[11px] text-neutral-600">Só o root concede/revoga admin.</p>
      )}
    </div>
  );
}
