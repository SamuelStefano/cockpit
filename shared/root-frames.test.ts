import { describe, it, expect } from 'vitest';
import { ROOT_ONLY, isRootOnly, isRootOnlyFrame } from './root-frames';

describe('isRootOnly', () => {
  it('covers every listed owner frame', () => {
    for (const t of ROOT_ONLY) expect(isRootOnly(t)).toBe(true);
  });

  it('keeps the custom ACP agent save and probe for root', () => {
    expect(isRootOnly('agent-add-custom')).toBe(true);
    expect(isRootOnly('agent-probe-draft')).toBe(true);
  });

  it('keeps provider API keys for root', () => {
    for (const t of ['byo-keys-get', 'byo-key-set', 'byo-key-remove']) expect(isRootOnly(t)).toBe(true);
  });

  it('covers an unlisted frame by its owner prefix', () => {
    for (const t of ['points-future', 'pontos-x', 'drafts-new', 'admin-env-rotate', 'admin-mcp-x', 'admin-cli-x', 'admin-deck-x']) {
      expect(isRootOnly(t)).toBe(true);
    }
  });

  it('leaves the plain admin surface alone', () => {
    for (const t of ['admin-health', 'agents-get', 'agent-connect', 'agent-test', 'send', 'canvas-get', 'refresh-models', 'accounts-list']) {
      expect(isRootOnly(t)).toBe(false);
    }
  });
});

describe('isRootOnlyFrame', () => {
  it('reads the parsed t, so a JSON escape does not hide it', () => {
    expect(isRootOnlyFrame('{"t":"points\\u002dadd","title":"x","points":1}')).toBe(true);
    expect(isRootOnlyFrame(JSON.stringify({ t: 'admin-env-set', name: 'A', value: 'b' }))).toBe(true);
  });

  it('ignores a frame that only mentions an owner frame in a field', () => {
    expect(isRootOnlyFrame(JSON.stringify({ t: 'send', sessionKey: 'k', text: 'points-add' }))).toBe(false);
  });

  it('treats unparseable or t-less text as not root-only', () => {
    expect(isRootOnlyFrame('not json')).toBe(false);
    expect(isRootOnlyFrame('{"x":1}')).toBe(false);
    expect(isRootOnlyFrame('null')).toBe(false);
  });
});
