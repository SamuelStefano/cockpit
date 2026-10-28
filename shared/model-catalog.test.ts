import { describe, it, expect } from 'vitest';
import { describeModel, matchesSearch, searchHaystack, shortModelName } from './model-catalog';

describe('model catalog', () => {
  it('shortens names to the model only', () => {
    expect(shortModelName('claude-sonnet-5-5', 'Claude Sonnet 5.5')).toBe('Sonnet 5.5');
    expect(shortModelName('claude-opus-5-5')).toBe('Opus 5.5');
    expect(shortModelName('claude-sonnet-4-20250514')).toBe('Sonnet 4');
    expect(shortModelName('opus')).toBe('Opus');
    expect(shortModelName('agent:grok', 'Grok · agente')).toBe('Grok');
  });
  it('maps agents to providers and capabilities', () => {
    expect(describeModel('agent:grok').providerId).toBe('xai');
    expect(describeModel('agent:gemini').caps).toContain('vision');
    expect(describeModel('agent:mine').providerId).toBe('other');
    expect(describeModel('claude-haiku-5').nick).toBe('mais rápido');
  });
  it('searches by name and capability words, accent-insensitive', () => {
    const h = searchHaystack(describeModel('claude-haiku-5'), 'Claude');
    expect(matchesSearch(h, 'rapido')).toBe(true);
    expect(matchesSearch(h, 'visão')).toBe(true);
    expect(matchesSearch(h, 'local')).toBe(false);
  });
});
