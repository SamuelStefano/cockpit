import { useMemo, useState } from 'react';
import type { HarnessConfig, HarnessContext, HarnessMode, HarnessModelChoice, HarnessVia } from '../../../shared/protocol';

// Estado local do composer. A escolha de modelo é sempre explícita (DR-003) — este
// hook só monta o HarnessModelChoice a partir do que o usuário selecionou.
export function useHarnessDraft(config: HarnessConfig | null) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<HarnessMode>('auto');
  const [via, setVia] = useState<HarnessVia>('plan'); // default plano = sem custo em dólar
  const [model, setModel] = useState('claude-sonnet-5');
  const [providerId, setProviderId] = useState('');
  const [executor, setExecutor] = useState('claude-haiku-4-5');
  const [advisor, setAdvisor] = useState('claude-opus-4-8');
  const [pentest, setPentest] = useState(false);

  const context: HarnessContext = pentest ? 'pentest' : null;

  const choice: HarnessModelChoice = useMemo(() => {
    if (mode === 'model') return { mode: 'model', model, via };
    if (mode === 'provider') return { mode: 'provider', providerId };
    if (mode === 'orchestrated') return { mode: 'orchestrated', executor, advisor };
    return { mode: 'auto', via };
  }, [mode, via, model, providerId, executor, advisor]);

  const providerOk = config?.providers.find((p) => p.id === providerId)?.configured ?? false;
  const nativeApiOk = config?.hasApiKey ?? false;
  // Modo nativo via plano não precisa de chave; via API sim. Auto sempre precisa da
  // chave (o classificador roda na API, enxuto), mesmo rodando a task no plano.
  const nativeMode = mode === 'auto' || mode === 'model';
  const needsApiKey = mode === 'provider' ? false : mode === 'auto' ? true : via === 'api';

  const blocked = pentest && mode === 'provider'
    ? 'pentest roda só em modelo nativo — troque o modo'
    : mode === 'provider' && !providerOk
      ? 'esse provedor não tem chave no painel de env'
      : needsApiKey && !nativeApiOk
        ? (mode === 'auto' ? 'auto precisa de ANTHROPIC_API_KEY pro classificador (a task pode rodar no plano)' : 'via API precisa de ANTHROPIC_API_KEY — ou troque pra Plano')
        : null;

  const canRun = prompt.trim().length > 0 && !blocked;

  return {
    prompt, setPrompt, mode, setMode, via, setVia, model, setModel, providerId, setProviderId,
    executor, setExecutor, advisor, setAdvisor, pentest, setPentest,
    context, choice, canRun, blocked, nativeMode,
  };
}
