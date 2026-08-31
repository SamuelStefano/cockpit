import type { HarnessConfig, HarnessNativeModel, HarnessTier } from '../../shared/protocol';

// Resolução de modelo do harness. O classificador só SUGERE um tier; a decisão de
// modelo é sempre explícita do usuário (DR-003).

// Modelos nativos Anthropic oferecidos no seletor. Os 3 primeiros casam com os tiers
// do classificador; fable entra como opção forte extra (o Samuel citou "opus/fable").
export const NATIVE_MODELS: HarnessNativeModel[] = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', tier: 'simple' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', tier: 'medium' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'complex' },
  { id: 'claude-fable-5', label: 'Fable 5', tier: 'complex' },
];

// Auto: tier sugerido → modelo nativo. Nunca cai no mais barato às cegas (o default
// seguro do classificador em falha é 'medium'; ver classifier.ts).
const TIER_NATIVE: Record<HarnessTier, string> = {
  simple: 'claude-haiku-4-5',
  medium: 'claude-sonnet-5',
  complex: 'claude-opus-4-8',
};

export function tierToNative(tier: HarnessTier): string {
  return TIER_NATIVE[tier];
}

export function isNativeModel(id: string): boolean {
  return NATIVE_MODELS.some((m) => m.id === id);
}

export function harnessConfig(env: Record<string, string>): HarnessConfig {
  return {
    nativeModels: NATIVE_MODELS,
    hasApiKey: !!env['ANTHROPIC_API_KEY'],
  };
}

export interface ResolvedTarget {
  model: string;
  apiKey?: string;
}

export function nativeTarget(model: string, env: Record<string, string>): ResolvedTarget {
  return { model, apiKey: env['ANTHROPIC_API_KEY'] };
}
