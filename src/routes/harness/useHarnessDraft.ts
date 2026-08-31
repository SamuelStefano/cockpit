import { useMemo, useState } from 'react';
import type { HarnessConfig, HarnessContext, HarnessMode, HarnessModelChoice, HarnessVia } from '../../../shared/protocol';

// Estado local do composer. A escolha de modelo é sempre explícita (DR-003) — este
// hook só monta o HarnessModelChoice a partir do que o usuário selecionou.
export function useHarnessDraft(config: HarnessConfig | null) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<HarnessMode>('auto');
  const [via, setVia] = useState<HarnessVia>('plan'); // default plano = sem custo em dólar
  const [model, setModel] = useState('claude-sonnet-5');
  const [executor, setExecutor] = useState('claude-haiku-4-5');
  const [advisor, setAdvisor] = useState('claude-opus-4-8');
  const [pentest, setPentest] = useState(false);

  const context: HarnessContext = pentest ? 'pentest' : null;

  const choice: HarnessModelChoice = useMemo(() => {
    if (mode === 'model') return { mode: 'model', model, via };
    if (mode === 'orchestrated') return { mode: 'orchestrated', executor, advisor };
    return { mode: 'auto', via };
  }, [mode, via, model, executor, advisor]);

  const nativeApiOk = config?.hasApiKey ?? false;
  // Modo nativo via plano não precisa de chave; via API sim. Auto sempre precisa da
  // chave (o classificador roda na API, enxuto), mesmo rodando a task no plano.
  const nativeMode = mode === 'auto' || mode === 'model';
  const needsApiKey = mode === 'auto' ? true : via === 'api';

  const blocked = needsApiKey && !nativeApiOk
    ? (mode === 'auto' ? 'auto precisa de ANTHROPIC_API_KEY pro classificador (a task pode rodar no plano)' : 'via API precisa de ANTHROPIC_API_KEY — ou troque pra Plano')
    : null;

  const canRun = prompt.trim().length > 0 && !blocked;

  return {
    prompt, setPrompt, mode, setMode, via, setVia, model, setModel,
    executor, setExecutor, advisor, setAdvisor, pentest, setPentest,
    context, choice, canRun, blocked, nativeMode,
  };
}
