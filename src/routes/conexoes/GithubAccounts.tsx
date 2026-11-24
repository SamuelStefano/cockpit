import { Button } from '../../components/primitives';
import type { GithubInstallation } from '../../lib/githubApp';

interface Props { accounts: GithubInstallation[]; busy: boolean; onUnlink: (id: number) => void }

export function GithubAccounts({ accounts, busy, onUnlink }: Props) {
  if (!accounts.length) return null;
  return (
    <ul className="mt-4 divide-y divide-neutral-800 rounded-xl border border-neutral-800">
      {accounts.map((a) => (
        <li key={a.installation_id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-neutral-100">
          <span className="min-w-0 truncate">GitHub · {a.account_login}</span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onUnlink(a.installation_id)}>Desconectar</Button>
        </li>
      ))}
    </ul>
  );
}
