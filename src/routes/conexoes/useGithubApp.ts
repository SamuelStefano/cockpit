import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../../components/primitives';
import { GITHUB_APP_ENABLED, githubInstallUrl, githubStatus, linkInstallation, unlinkInstallation, type GithubInstallation } from '../../lib/githubApp';

export function parseInstallParams(search: string): { installationId: number; code: string } | null {
  const q = new URLSearchParams(search);
  const id = Number(q.get('installation_id'));
  const code = q.get('code');
  return Number.isInteger(id) && id > 0 && code ? { installationId: id, code } : null;
}

export function useGithubApp() {
  const [accounts, setAccounts] = useState<GithubInstallation[]>([]);
  const [busy, setBusy] = useState(false);
  const landed = useRef(false);

  const refresh = useCallback(async () => {
    if (!GITHUB_APP_ENABLED) return;
    try { setAccounts(await githubStatus()); } catch { /* sem sessão ou função fora do ar: lista fica vazia */ }
  }, []);

  useEffect(() => {
    if (!GITHUB_APP_ENABLED || landed.current) return;
    landed.current = true;
    const p = parseInstallParams(location.search);
    if (!p) { void refresh(); return; }
    history.replaceState(null, '', location.pathname + location.hash);
    setBusy(true);
    linkInstallation(p.installationId, p.code)
      .then((login) => toast(`GitHub conectado: ${login}`))
      .catch(() => toast('Não foi possível conectar o GitHub. Tente de novo.', { tone: 'error' }))
      .finally(() => { setBusy(false); void refresh(); });
  }, [refresh]);

  const connect = useCallback(() => { location.href = githubInstallUrl(); }, []);
  const unlink = useCallback(async (installationId: number) => {
    setBusy(true);
    try { await unlinkInstallation(installationId); toast('GitHub desconectado'); }
    catch { toast('Não foi possível desconectar o GitHub.', { tone: 'error' }); }
    finally { setBusy(false); void refresh(); }
  }, [refresh]);

  return { enabled: GITHUB_APP_ENABLED, accounts, busy, connect, unlink };
}
