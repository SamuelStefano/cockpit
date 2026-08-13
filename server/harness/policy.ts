import { CATALOG, type ModelSlot, type ProviderDef } from '../router/catalog';
import type { HarnessConfig, HarnessNativeModel, HarnessProviderOption, HarnessTier } from '../../shared/protocol';

// Resolução de rota do harness. Reusa CATALOG (dado estático) de router/catalog.ts —
// NÃO importa router/state.ts nem ws/runs.ts (isolamento, DR-004). O classificador só
// SUGERE um tier; a decisão de modelo é sempre explícita do usuário (DR-003).

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

const TIER_SLOT: Record<HarnessTier, ModelSlot> = {
  simple: 'haiku',
  medium: 'sonnet',
  complex: 'opus',
};

export function tierToNative(tier: HarnessTier): string {
  return TIER_NATIVE[tier];
}

export function isNativeModel(id: string): boolean {
  return NATIVE_MODELS.some((m) => m.id === id);
}

// Provedores terceiros do catálogo (baseUrl !== null). Exclui o plano (OAuth) e a API
// nativa — o harness usa ANTHROPIC_API_KEY direto pro nativo, sem passar por provedor.
export function thirdPartyProviders(): ProviderDef[] {
  return CATALOG.filter((p) => p.baseUrl !== null && p.authEnv !== null);
}

export function harnessConfig(env: Record<string, string>): HarnessConfig {
  const providers: HarnessProviderOption[] = thirdPartyProviders().map((p) => ({
    id: p.id,
    label: p.label,
    tier: p.tier,
    configured: !!(p.authEnv && env[p.authEnv]),
  }));
  return {
    nativeModels: NATIVE_MODELS,
    providers,
    hasApiKey: !!env['ANTHROPIC_API_KEY'],
  };
}

export interface ResolvedTarget {
  model: string;
  providerId?: string;
  baseURL?: string;
  apiKey?: string;
  authToken?: string;
  costApprox: boolean;
}

// Credencial de um provedor terceiro, no formato que o construtor do @anthropic-ai/sdk
// espera: bearer → authToken (Authorization), api-key → apiKey (x-api-key).
function providerCred(p: ProviderDef, env: Record<string, string>): { apiKey?: string; authToken?: string } | null {
  if (!p.authEnv) return null;
  const key = env[p.authEnv];
  if (!key) return null;
  return p.authMode === 'bearer' ? { authToken: key } : { apiKey: key };
}

export function nativeTarget(model: string, env: Record<string, string>): ResolvedTarget {
  return { model, apiKey: env['ANTHROPIC_API_KEY'], costApprox: false };
}

// Alvo de provedor terceiro pra um tier. `null` = provedor sem chave configurada.
export function providerTarget(providerId: string, tier: HarnessTier, env: Record<string, string>): ResolvedTarget | null {
  const p = thirdPartyProviders().find((x) => x.id === providerId);
  if (!p || !p.baseUrl) return null;
  const cred = providerCred(p, env);
  if (!cred) return null;
  return {
    model: p.models[TIER_SLOT[tier]],
    providerId: p.id,
    baseURL: p.baseUrl,
    ...cred,
    costApprox: true,
  };
}
