import { useEffect } from 'react';
import { AdminAccounts } from '../AdminAccounts';
import { SectionTitle } from '../../components/primitives';
import type { AccountSummary } from '../../../shared/protocol';
import { useAdminOpToast } from './useAdminOpToast';

interface PessoasProps {
  accounts: AccountSummary[];
  loaded: boolean;
  onAccountsList: () => void;
  onSetAdmin: (accountId: string, admin: boolean) => void;
  adminOp: { ok: boolean; message: string } | null;
}

export function Pessoas({ accounts, loaded, onAccountsList, onSetAdmin, adminOp }: PessoasProps) {
  useAdminOpToast(adminOp);
  useEffect(() => { if (adminOp?.ok) onAccountsList(); }, [adminOp, onAccountsList]);
  return (
    <>
      <SectionTitle>Pessoas</SectionTitle>
      <AdminAccounts accounts={accounts} loaded={loaded} onAccountsList={onAccountsList} onSetAdmin={onSetAdmin} canGrant />
    </>
  );
}
