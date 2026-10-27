import type { ClaudeLoginView } from '../../../shared/protocol';
import type { AgentsApi } from '../../cockpit/useAgents';
import { Button } from '../primitives';
import { ClaudeAuthBanner } from './ClaudeAuthBanner';
import { ProviderCard } from './ProviderCard';
import { ProviderSetup } from './ProviderSetup';
import { useProviderOnboarding } from './useProviderOnboarding';

interface ProviderOnboardingProps {
  agents: AgentsApi;
  claudeReady: boolean;
  login?: ClaudeLoginView;
  onStart?: () => void;
  onCode?: (code: string) => void;
  onCancel?: () => void;
}

export function ProviderOnboarding({ agents, claudeReady, login, onStart, onCode, onCancel }: ProviderOnboardingProps) {
  const p = useProviderOnboarding(agents, claudeReady);
  if (p.dismissed) return <ClaudeAuthBanner login={login} onStart={onStart} onCode={onCode} onCancel={onCancel} />;
  const claudeSelected = p.selected.includes('claude');
  const others = p.targets.filter((c) => c.id !== 'claude');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <p className="text-[14px] font-semibold text-neutral-100">Escolha seus provedores</p>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
          O Deck usa vários provedores disponíveis na sua VPS: Claude, Grok, OpenCode Go e Codex. Marque os que quer configurar agora — dá pra mudar depois.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {p.cards.map((c) => (
            <ProviderCard key={c.id} card={c} selected={p.selected.includes(c.id)} onToggle={() => p.toggle(c.id)} />
          ))}
        </div>
        {others.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {others.map((c) => <ProviderSetup key={c.id} card={c} onOpen={() => p.open(c.id)} />)}
          </div>
        )}
        {claudeSelected && (
          <div className="-mx-4 mt-1">
            <ClaudeAuthBanner login={login} onStart={onStart} onCode={onCode} onCancel={onCancel} />
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={p.dismiss}>Agora não</Button>
        </div>
      </div>
    </div>
  );
}
