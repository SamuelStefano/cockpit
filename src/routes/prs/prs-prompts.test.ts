import { describe, expect, it } from 'vitest';
import { fixCiPrompt, reviewPrompt } from './prs-prompts';

const pr = { url: 'https://github.com/a/b/pull/7', number: 7, headRef: 'fix/x' };

describe('fixCiPrompt', () => {
  it('lists failing checks and the branch', () => {
    const p = fixCiPrompt(pr, ['build', 'lint']);
    expect(p).toContain(pr.url);
    expect(p).toContain('- build');
    expect(p).toContain('- lint');
    expect(p).toContain('fix/x');
    expect(p).toContain('gh');
  });
  it('works without check names', () => {
    expect(fixCiPrompt(pr, [])).not.toContain('Checks que falharam');
  });
});

describe('reviewPrompt', () => {
  it('asks for a chat-only review', () => {
    const p = reviewPrompt(pr);
    expect(p).toContain(pr.url);
    expect(p).toContain('code-review');
    expect(p).toContain('Não comente');
  });
});
