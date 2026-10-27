import { Button } from '../primitives';
import type { ProviderCardModel } from '../../cockpit/provider-onboarding';

interface ProviderSetupProps {
  card: ProviderCardModel;
  onOpen: () => void;
}

export function ProviderSetup({ card, onOpen }: ProviderSetupProps) {
  const command = card.status === 'missing' || card.status === 'unknown' ? card.install : card.login;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <p className="text-[13px] font-semibold text-neutral-100">{card.label}</p>
      {command && (
        <p className="mt-1.5 text-[12px] text-neutral-400">
          Comando: <code className="break-all rounded-sm bg-black/40 px-1 py-0.5 font-mono text-neutral-200">{command}</code>
          {card.soon && <span className="ml-1.5 text-amber-300">em breve</span>}
        </p>
      )}
      {card.soon && !command && <p className="mt-1.5 text-[12px] text-amber-300">Instalação guiada em breve.</p>}
      {!card.soon && (
        <Button className="mt-2.5" size="sm" variant="secondary" icon="terminal" onClick={onOpen}>
          Instalar e entrar no terminal
        </Button>
      )}
    </div>
  );
}
