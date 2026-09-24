import { describe, it, expect } from 'vitest';
import { sandboxPerms } from './SandboxPreview';

describe('sandboxPerms', () => {
  const deck = 'http://localhost:7777';

  it('keeps allow-same-origin for another origin (the preview needs its own cookies)', () => {
    expect(sandboxPerms('https://x.preview.devfellowship.com/', deck)).toContain('allow-same-origin');
    expect(sandboxPerms('http://x.localhost:7777/', deck)).toContain('allow-same-origin');
  });

  it('drops allow-same-origin when the target is the Deck itself', () => {
    expect(sandboxPerms('http://localhost:7777/some/page', deck)).not.toContain('allow-same-origin');
    expect(sandboxPerms('/relative', deck)).not.toContain('allow-same-origin');
    expect(sandboxPerms('http://localhost:7777/', deck)).toContain('allow-scripts');
  });
});
