import { useEffect } from 'react';
import { Button, ListRow, SectionTitle } from '../../components/primitives';
import { ClaudeLoginDetail } from '../onboarding/ClaudeLoginDetail';
import type { ClaudeAccount, ClaudeLoginView } from '../../../shared/protocol';

interface ClaudeAccountCardProps {
  account: ClaudeAccount | null;
  login: ClaudeLoginView;
  onGet: () => void;
  onLogout: () => void;
  onLoginStart: () => void;
  onLoginCode: (code: string) => void;
  onLoginCancel: () => void;
}

export function ClaudeAccountCard(p: ClaudeAccountCardProps) {
  const { onGet } = p;
  useEffect(() => { onGet(); }, [onGet]);
  const switching = p.login.state !== 'idle' && p.login.state !== 'done';
  const connected = !!p.account?.loggedIn;
  const label = connected ? (p.account?.email ?? 'Conectado') : 'Não conectado';
  const hint = connected ? (p.account?.orgName ?? p.account?.authMethod) : undefined;

  return (
    <div className="mb-6">
      <SectionTitle>Conta do Claude</SectionTitle>
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 hairline">
        <ListRow
          label={label}
          hint={hint}
          className="max-sm:flex-wrap"
          trailing={
            <span className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={switching} onClick={p.onLoginStart}>Trocar conta</Button>
              {connected && (
                <Button
                  variant="danger" size="sm" disabled={switching}
                  onClick={() => { if (window.confirm('Desconectar o Claude desta box? Sessões param até logar de novo.')) p.onLogout(); }}
                >
                  Desconectar
                </Button>
              )}
            </span>
          }
        />
        {switching ? (
          <div className="flex flex-col gap-3 border-t border-neutral-800 px-4 py-3">
            <ClaudeLoginDetail login={p.login} onStart={p.onLoginStart} onCode={p.onLoginCode} onCancel={p.onLoginCancel} />
            {p.login.error && <p role="alert" className="text-[13px] text-red-400">{p.login.error}</p>}
            <Button className="w-fit" variant="ghost" size="sm" onClick={p.onLoginCancel}>Cancelar</Button>
          </div>
        ) : (
          <p className="border-t border-neutral-800 px-4 py-2 text-[12px] text-neutral-500">A conta atual continua ativa até a nova concluir</p>
        )}
      </div>
    </div>
  );
}
