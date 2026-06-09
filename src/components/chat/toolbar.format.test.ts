import { describe, it, expect } from 'vitest';
import { shortModel, prettyModel, modelFamily, turnStatParts, contextMeter, CONTEXT_LIMIT } from './toolbar.format';

describe('shortModel', () => {
  it('maps full CLI model names to short aliases', () => {
    expect(shortModel('claude-opus-4-8')).toBe('opus');
    expect(shortModel('claude-sonnet-4-6')).toBe('sonnet');
    expect(shortModel('claude-haiku-4-5')).toBe('haiku');
  });

  it('returns "" for undefined and passes through unknown names', () => {
    expect(shortModel(undefined)).toBe('');
    expect(shortModel('gpt-9')).toBe('gpt-9');
  });
});

describe('modelFamily', () => {
  it('detects family from concrete id and alias', () => {
    expect(modelFamily('claude-opus-4-8')).toBe('opus');
    expect(modelFamily('opus')).toBe('opus');
    expect(modelFamily('claude-sonnet-4-6')).toBe('sonnet');
    expect(modelFamily('haiku')).toBe('haiku');
  });
  it('returns null for unknown/empty', () => {
    expect(modelFamily(undefined)).toBeNull();
    expect(modelFamily('gpt-9')).toBeNull();
  });
});

describe('prettyModel', () => {
  it('derives "Family X.Y" from concrete id', () => {
    expect(prettyModel('claude-opus-4-8')).toBe('Opus 4.8');
    expect(prettyModel('claude-sonnet-4-6')).toBe('Sonnet 4.6');
    expect(prettyModel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5');
  });
  it('capitalizes bare aliases without inventing a version', () => {
    expect(prettyModel('opus')).toBe('Opus');
    expect(prettyModel('sonnet')).toBe('Sonnet');
  });
  it('prefers a friendly API display_name over the id', () => {
    expect(prettyModel('claude-opus-4-8', 'Claude Opus 4.8')).toBe('Claude Opus 4.8');
  });
  it('ignores display_name when it is just the raw id echoed back', () => {
    expect(prettyModel('claude-opus-4-8', 'claude-opus-4-8')).toBe('Opus 4.8');
  });
  it('falls through for unknown models and empty input', () => {
    expect(prettyModel(undefined)).toBe('');
    expect(prettyModel('gpt-9')).toBe('gpt-9');
    expect(prettyModel('gpt-9', 'GPT-9')).toBe('GPT-9');
  });
});

describe('turnStatParts', () => {
  it('returns null with no usable stats', () => {
    expect(turnStatParts(undefined)).toBeNull();
    expect(turnStatParts({})).toBeNull();
  });

  it('uses 4 decimals for sub-cent cost, 3 otherwise', () => {
    expect(turnStatParts({ costUsd: 0.0042 })!.parts).toEqual(['$0.0042']);
    expect(turnStatParts({ costUsd: 0.25 })!.parts).toEqual(['$0.250']);
  });

  it('formats duration in seconds and includes the short model', () => {
    const out = turnStatParts({ costUsd: 0.1, durationMs: 3400, model: 'claude-opus-4-8' })!;
    expect(out.parts).toEqual(['$0.100', '3.4s']);
    expect(out.model).toBe('opus');
  });
});

describe('contextMeter', () => {
  it('returns null at or below zero tokens', () => {
    expect(contextMeter(0)).toBeNull();
    expect(contextMeter(-5)).toBeNull();
  });

  it('computes percentage, thresholds and k label', () => {
    const low = contextMeter(20_000)!;
    expect(low).toMatchObject({ pct: 10, high: false, mid: false, k: '20' });
    const mid = contextMeter(120_000)!;
    expect(mid).toMatchObject({ mid: true, high: false });
    const high = contextMeter(160_000)!;
    expect(high).toMatchObject({ mid: true, high: true });
  });

  it('caps percentage at 100', () => {
    expect(contextMeter(CONTEXT_LIMIT * 2)!.pct).toBe(100);
  });
});
