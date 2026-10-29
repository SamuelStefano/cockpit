// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { parsePromptLink, buildPromptLink, sanitizePrompt, capturePromptFromLocation, takePendingPrompt, PROMPT_LINK_MAX } from './prompt-link';

describe('parsePromptLink', () => {
  it('reads the prompt from /novo', () => {
    expect(parsePromptLink('https://deck.test/novo?prompt=Fix%20the%20build')).toEqual({ prompt: 'Fix the build', truncated: false, hadInvisible: false });
  });
  it('accepts / and a bare query', () => {
    expect(parsePromptLink('/?prompt=hi')?.prompt).toBe('hi');
    expect(parsePromptLink('/novo?prompt=hi')?.prompt).toBe('hi');
  });
  it('ignores other paths, missing and blank prompts', () => {
    expect(parsePromptLink('https://deck.test/skills?prompt=hi')).toBeNull();
    expect(parsePromptLink('https://deck.test/novo')).toBeNull();
    expect(parsePromptLink('https://deck.test/novo?prompt=%20%20')).toBeNull();
  });
  it('strips invisible characters and flags them', () => {
    const hidden = 'a\u200Bb\u202Ec\uFEFFd\u{E0041}e\u2066f';
    expect(parsePromptLink(`/novo?prompt=${encodeURIComponent(hidden)}`)).toEqual({ prompt: 'abcdef', truncated: false, hadInvisible: true });
  });
  it('truncates beyond the limit', () => {
    const r = parsePromptLink(`/novo?prompt=${'x'.repeat(PROMPT_LINK_MAX + 5)}`)!;
    expect(r.prompt).toHaveLength(PROMPT_LINK_MAX);
    expect(r.truncated).toBe(true);
  });
  it('does not split surrogate pairs when truncating', () => {
    const r = sanitizePrompt('😀'.repeat(PROMPT_LINK_MAX + 1));
    expect(Array.from(r.prompt)).toHaveLength(PROMPT_LINK_MAX);
  });
});

describe('buildPromptLink', () => {
  it('round-trips through parse', () => {
    const draft = 'Olá & "mundo"\nlinha 2 ?x=1';
    expect(parsePromptLink(buildPromptLink('https://deck.test', draft))?.prompt).toBe(draft);
  });
});

describe('capture and take', () => {
  beforeEach(() => { sessionStorage.clear(); history.replaceState(null, '', '/'); });
  it('stores the prompt, cleans the URL and is consumed once', () => {
    history.replaceState(null, '', '/novo?prompt=hello%20there');
    capturePromptFromLocation();
    expect(location.pathname + location.search).toBe('/');
    expect(takePendingPrompt()?.prompt).toBe('hello there');
    expect(takePendingPrompt()).toBeNull();
  });
  it('leaves unrelated URLs alone', () => {
    history.replaceState(null, '', '/skills?prompt=x');
    capturePromptFromLocation();
    expect(location.pathname).toBe('/skills');
    expect(takePendingPrompt()).toBeNull();
  });
});
