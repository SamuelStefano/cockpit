import { describe, it, expect } from 'vitest';
import { harnessConfig, isNativeModel, nativeTarget, providerTarget, tierToNative, NATIVE_MODELS } from './policy';

describe('tierToNative', () => {
  it('mapeia cada tier pro modelo nativo do slot', () => {
    expect(tierToNative('simple')).toBe('claude-haiku-4-5');
    expect(tierToNative('medium')).toBe('claude-sonnet-5');
    expect(tierToNative('complex')).toBe('claude-opus-4-8');
  });
});

describe('isNativeModel', () => {
  it('reconhece só os modelos do catálogo nativo', () => {
    expect(isNativeModel('claude-opus-4-8')).toBe(true);
    expect(isNativeModel('claude-fable-5')).toBe(true);
    expect(isNativeModel('glm-4.6')).toBe(false);
    expect(isNativeModel('')).toBe(false);
  });
});

describe('harnessConfig', () => {
  it('reflete presença de chave nativa e de cada provedor', () => {
    const cfg = harnessConfig({ ANTHROPIC_API_KEY: 'x', OPENROUTER_API_KEY: 'y' });
    expect(cfg.hasApiKey).toBe(true);
    expect(cfg.nativeModels).toEqual(NATIVE_MODELS);
    const or = cfg.providers.find((p) => p.id === 'openrouter');
    expect(or?.configured).toBe(true);
    const zai = cfg.providers.find((p) => p.id === 'zai-glm');
    expect(zai?.configured).toBe(false);
  });

  it('sem chave nativa marca hasApiKey false', () => {
    expect(harnessConfig({}).hasApiKey).toBe(false);
  });
});

describe('nativeTarget', () => {
  it('usa ANTHROPIC_API_KEY e não é custo aproximado', () => {
    const t = nativeTarget('claude-sonnet-5', { ANTHROPIC_API_KEY: 'k' });
    expect(t).toMatchObject({ model: 'claude-sonnet-5', apiKey: 'k', costApprox: false });
    expect(t.baseURL).toBeUndefined();
    expect(t.providerId).toBeUndefined();
  });
});

describe('providerTarget', () => {
  it('provedor bearer configurado → authToken + baseURL + modelo do slot, custo aproximado', () => {
    const t = providerTarget('openrouter', 'medium', { OPENROUTER_API_KEY: 'sk-or' });
    expect(t).not.toBeNull();
    expect(t!.authToken).toBe('sk-or');
    expect(t!.apiKey).toBeUndefined();
    expect(t!.baseURL).toBe('https://openrouter.ai/api');
    expect(t!.providerId).toBe('openrouter');
    expect(t!.costApprox).toBe(true);
    expect(t!.model).toBeTruthy();
  });

  it('provedor sem chave → null (não escolhe rota que falharia)', () => {
    expect(providerTarget('openrouter', 'medium', {})).toBeNull();
  });

  it('provedor desconhecido → null', () => {
    expect(providerTarget('nao-existe', 'simple', { X: 'y' })).toBeNull();
  });
});
