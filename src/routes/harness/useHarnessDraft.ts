import { useMemo, useState } from 'react';
import type { HarnessConfig, HarnessContext, HarnessMode, HarnessModelChoice } from '../../../shared/protocol';

// Estado local do composer. A escolha de modelo é sempre explícita (DR-003) — este
// hook só monta o HarnessModelChoice a partir do que o usuário selecionou.
export function useHarnessDraft(config: HarnessConfig | null) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<HarnessMode>('auto');
  const [model, setModel] = useState('claude-sonnet-5');
  const [providerId, setProviderId] = useState('');
  const [executor, setExecutor] = useState('claude-haiku-4-5');
  const [advisor, setAdvisor] = useState('claude-opus-4-8');
  const [pentest, setPentest] = useState(false);

  const context: HarnessContext = pentest ? 'pentest' : null;

  const choice: HarnessModelChoice = useMemo(() => {
    if (mode === 'model') return { mode: 'model', model };
    if (mode === 'provider') return { mode: 'provider', providerId };
    if (mode === 'orchestrated') return { mode: 'orchestrated', executor, advisor };
    return { mode: 'auto' };
  }, [mode, model, providerId, executor, advisor]);

  const providerOk = config?.providers.find((p) => p.id === providerId)?.configured ?? false;
  const nativeOk = config?.hasApiKey ?? false;

  // Pentest roda só em nativo (requisito) — bloqueia o modo provider quando ligado.
  const blocked = pentest && mode === 'provider'
    ? 'pentest roda só em modelo nativo — troque o modo'
    : mode === 'provider' && !providerOk
      ? 'esse provedor não tem chave no painel de env'
      : mode !== 'provider' && !nativeOk
        ? 'falta ANTHROPIC_API_KEY no painel de env'
        : null;

  const canRun = prompt.trim().length > 0 && !blocked;

  return {
    prompt, setPrompt, mode, setMode, model, setModel, providerId, setProviderId,
    executor, setExecutor, advisor, setAdvisor, pentest, setPentest,
    context, choice, canRun, blocked,
  };
}
