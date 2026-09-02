import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountSummary, AdminHealth, ClientMsg, ServerMsg, UsageStats } from '../../shared/protocol';

export interface Admin {
  usageStats: UsageStats | null;
  health: AdminHealth | null;
  accounts: AccountSummary[];
  accountsLoaded: boolean;
  adminOp: { ok: boolean; message: string } | null;
  onUsageList: () => void;
  onHealthList: () => void;
  onAccountsList: () => void;
  onSetAdmin: (accountId: string, admin: boolean) => void;
  onEnvSet: (name: string, value: string) => void;
  onEnvUnset: (name: string) => void;
  onMcpAdd: (name: string, opts: { command?: string; url?: string }) => void;
  onMcpRemove: (name: string) => void;
  onCliInstall: (name: string) => void;
  onCliUpdate: () => void;
  onDeckRestart: (mode: 'idle' | 'now') => void;
  onMsg: (msg: ServerMsg) => boolean;
}

const BANNER_MS = { ok: 4000, err: 8000 };

export function useAdmin(send: (m: ClientMsg) => boolean): Admin {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [adminOp, setAdminOp] = useState<{ ok: boolean; message: string } | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // O timer do banner sobrevivia ao unmount e disparava setAdminOp num hook morto.
  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'usage-stats': {
        // O server devolve EMPTY_STATS (tudo zero) quando o SQLite está em lock
        // (db.usageStats() cai no fallback). Não apaga um painel já populado por
        // causa de um snapshot vazio transitório — só substitui se vier dado real
        // ou se ainda não temos nada.
        const s = msg.stats;
        const empty = s.totalSamples === 0 && s.sessions.length === 0 && s.series.length === 0;
        setUsageStats((prev) => (empty && prev && prev.totalSamples > 0 ? prev : s));
        return true;
      }
      case 'health':
        setHealth(msg.health);
        return true;
      case 'accounts':
        setAccounts(msg.accounts);
        setAccountsLoaded(true);
        return true;
      case 'admin-op':
        setAdminOp({ ok: msg.ok, message: msg.message });
        // Auto-limpa o banner: sem isto um "salvo"/erro fica preso no painel até a
        // próxima op ou reload (a UI nunca reseta o estado). Erro fica mais tempo.
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setAdminOp(null), msg.ok ? BANNER_MS.ok : BANNER_MS.err);
        return true;
      default:
        return false;
    }
  }, []);

  return {
    usageStats,
    health,
    accounts,
    accountsLoaded,
    adminOp,
    onUsageList: useCallback(() => { send({ t: 'usage-list' }); }, [send]),
    onHealthList: useCallback(() => { send({ t: 'admin-health' }); }, [send]),
    // Painel admin de contas (T3): listar usuários e ligar/desligar admin. Tratado
    // NO RELAY (service-role); o gate de papel é lá. No loopback estes frames não têm
    // handler e a UI fica escondida (só aparece com Supabase ligado).
    onAccountsList: useCallback(() => { send({ t: 'accounts-list' }); }, [send]),
    onSetAdmin: useCallback((accountId: string, admin: boolean) => { send({ t: 'set-admin', accountId, admin }); }, [send]),
    onEnvSet: useCallback((name: string, value: string) => { send({ t: 'admin-env-set', name, value }); }, [send]),
    onEnvUnset: useCallback((name: string) => { send({ t: 'admin-env-unset', name }); }, [send]),
    onMcpAdd: useCallback((name: string, opts: { command?: string; url?: string }) => { send({ t: 'admin-mcp-add', name, command: opts.command, url: opts.url }); }, [send]),
    onMcpRemove: useCallback((name: string) => { send({ t: 'admin-mcp-remove', name }); }, [send]),
    onCliInstall: useCallback((name: string) => { send({ t: 'admin-cli-install', name }); }, [send]),
    onCliUpdate: useCallback(() => { send({ t: 'admin-cli-update' }); }, [send]),
    onDeckRestart: useCallback((mode: 'idle' | 'now') => { send({ t: 'admin-deck-restart', mode }); }, [send]),
    onMsg,
  };
}
