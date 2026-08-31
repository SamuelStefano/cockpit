import { describe, it, expect } from 'vitest';
import { harnessConfig, isNativeModel, nativeTarget, tierToNative, NATIVE_MODELS } from './policy';

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
  it('reflete presença da chave nativa', () => {
    const cfg = harnessConfig({ ANTHROPIC_API_KEY: 'x' });
    expect(cfg.hasApiKey).toBe(true);
    expect(cfg.nativeModels).toEqual(NATIVE_MODELS);
  });

  it('sem chave nativa marca hasApiKey false', () => {
    expect(harnessConfig({}).hasApiKey).toBe(false);
  });
});

describe('nativeTarget', () => {
  it('usa ANTHROPIC_API_KEY', () => {
    expect(nativeTarget('claude-sonnet-5', { ANTHROPIC_API_KEY: 'k' }))
      .toEqual({ model: 'claude-sonnet-5', apiKey: 'k' });
  });
});
