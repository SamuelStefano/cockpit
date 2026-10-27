import type { ClaudeLoginView } from '../../shared/protocol';
import type { AgentsApi } from '../cockpit/useAgents';
import type { ClaudeImportApi } from '../cockpit/useClaudeImport';
import { ClaudeImportCard } from '../components/chat/ClaudeImportCard';
import { Bit } from '../components/bit/Bit';
import { Button } from '../components/primitives';
import { useProviderOnboarding } from '../components/chat/useProviderOnboarding';
import { buildOnboardingRows, type ProviderRowModel } from '../cockpit/onboarding-rows';
import { ClaudeLoginDetail } from './onboarding/ClaudeLoginDetail';
import { DeviceCode } from './onboarding/DeviceCode';
import { ProviderRow } from './onboarding/ProviderRow';

interface OnboardingProps {
  agents: AgentsApi;
  claudeImport?: ClaudeImportApi;
  claudeReady: boolean;
  login?: ClaudeLoginView;
  onStart?: () => void;
  onCode?: (code: string) => void;
  onCancel?: () => void;
  onDone: () => void;
}

export function Onboarding({ agents, claudeImport, claudeReady, login, onStart, onCode, onCancel, onDone }: OnboardingProps) {
  const p = useProviderOnboarding(agents, claudeReady);
  const rows = buildOnboardingRows(p.cards, agents.items, p.loaded, claudeReady, login);

  const claudeAction = (row: ProviderRowModel) => {
    if (row.state === 'waiting-login') return <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>;
    return <Button size="sm" variant={row.state === 'error' ? 'secondary' : 'primary'} icon="link" onClick={onStart}>{row.state === 'error' ? 'Tentar de novo' : 'Conectar'}</Button>;
  };

  const agentAction = (row: ProviderRowModel) => {
    const id = row.providerId;
    if (!id) return null;
    if (row.state === 'waiting-login') return <Button size="sm" variant="secondary" icon="terminal" onClick={() => p.open(id)}>Abrir terminal</Button>;
    if (row.state === 'error') return <Button size="sm" variant="secondary" icon="rotate" onClick={() => agents.test(id)}>Tentar de novo</Button>;
    return <Button size="sm" variant="secondary" icon="download" onClick={() => { agents.connect(id); p.open(id); }}>Instalar</Button>;
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto" style={{ background: 'radial-gradient(90% 60% at 50% -10%, rgba(249,115,22,.07), transparent 60%)' }}>
      <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col items-center px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
        <div className="mb-7 flex items-center gap-2.5">
          <Bit state="wave" size={40} />
          <span className="text-[18px] text-neutral-100">Deck</span>
        </div>
        <h1 className="text-center text-[26px] font-semibold tracking-tight text-neutral-100">Conecte um provedor</h1>
        <p className="mb-7 mt-2 max-w-[420px] text-center text-[14px] leading-relaxed text-neutral-400">
          O Deck usa a sua própria assinatura ou chave. Basta um pra começar; os outros dá pra ligar depois em Configurações.
        </p>
        <ul aria-label="Provedores" className="flex w-full flex-col gap-2">
          {rows.map((row) => row.id === 'claude' ? (
            <ProviderRow key={row.id} row={row} action={claudeAction(row)} detail={<ClaudeLoginDetail login={login} onStart={onStart} onCode={onCode} onCancel={onCancel} />} />
          ) : (
            <ProviderRow key={row.id} row={row} action={agentAction(row)} detail={row.command ? <DeviceCode command={row.command} /> : undefined} />
          ))}
        </ul>
        {claudeImport && <div className="w-full">
          <ClaudeImportCard api={claudeImport} />
        </div>}
        <div className="mt-7 flex flex-col items-center gap-2.5">
          <Button size="md" icon="chevronRight" iconRight className="h-10 px-5" onClick={onDone}>Começar a conversar</Button>
          <p className="text-center text-[12px] text-neutral-500">Sabrina vai usar o Deck também? Convide depois em Configurações › Pessoas.</p>
        </div>
      </div>
    </div>
  );
}
