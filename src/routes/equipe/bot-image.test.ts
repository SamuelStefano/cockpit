import { describe, it, expect, vi } from 'vitest';
import { botImageResolver, workspaceImagePath } from './bot-image';

describe('bot image resolver', () => {
  it('keeps only workspace-relative paths', () => {
    expect(workspaceImagePath('./mock/tela.png')).toBe('mock/tela.png');
    expect(workspaceImagePath('https://x.com/a.png')).toBeNull();
    expect(workspaceImagePath('data:image/png;base64,AAA')).toBeNull();
    expect(workspaceImagePath('/etc/a.png')).toBe('unsafe');
    expect(workspaceImagePath('../outro/a.png')).toBe('unsafe');
  });

  it('asks the bot files api and maps the cached file', () => {
    const fetchFile = vi.fn();
    const r = botImageResolver('capo1', { 'capo1:mock.png': { status: 'ok', mime: 'image/png', size: 3, url: 'data:image/png;base64,cG5n' } }, fetchFile);
    expect(r.get('./mock.png')).toEqual({ status: 'ok', url: 'data:image/png;base64,cG5n' });
    expect(r.get('nota.md')).toBeNull();
    r.request('nota.md');
    r.request('../x.png');
    r.request('https://x.com/a.png');
    expect(fetchFile.mock.calls).toEqual([['capo1', 'nota.md']]);
    expect(r.get('../x.png')).toEqual({ status: 'error', error: 'caminho inválido' });
  });
});
