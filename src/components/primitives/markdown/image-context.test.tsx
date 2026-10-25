// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Markdown } from '../Markdown';
import { ImageResolverContext, type ImageResolver, type ResolvedImage } from './image-context';

afterEach(cleanup);

const md = 'Proposta:\n\n![Mockup do cadastro](mock.png)';

describe('markdown image', () => {
  it('renders inline through the resolver, asking for the file once', () => {
    const state: Record<string, ResolvedImage> = {};
    const resolver: ImageResolver = { get: (s) => state[s] ?? null, request: vi.fn((s: string) => { state[s] = { status: 'loading' }; }) };
    const r = render(<ImageResolverContext.Provider value={resolver}><Markdown md={md} /></ImageResolverContext.Provider>);
    expect(resolver.request).toHaveBeenCalledWith('mock.png');
    state['mock.png'] = { status: 'ok', url: 'data:image/png;base64,cG5n' };
    r.rerender(<ImageResolverContext.Provider value={{ ...resolver }}><Markdown md={`${md} `} /></ImageResolverContext.Provider>);
    const img = r.getByAltText('Mockup do cadastro') as HTMLImageElement;
    expect(img.src).toBe('data:image/png;base64,cG5n');
    expect(resolver.request).toHaveBeenCalledTimes(1);
  });

  it('without a resolver fetches nothing: caption for a local file, link for a remote one', () => {
    const r = render(<Markdown md={'![Mockup](mock.png) ![remoto](https://x.com/a.png)'} />);
    expect(r.container.querySelector('img')).toBeNull();
    expect(r.getByText('Mockup').tagName).toBe('SPAN');
    expect((r.getByText('remoto') as HTMLAnchorElement).href).toBe('https://x.com/a.png');
  });

  it('a refused file shows its caption', () => {
    const resolver: ImageResolver = { get: () => ({ status: 'error', error: 'caminho inválido' }), request: vi.fn() };
    const r = render(<ImageResolverContext.Provider value={resolver}><Markdown md={'![fora](../x.png)'} /></ImageResolverContext.Provider>);
    expect(r.container.querySelector('img')).toBeNull();
    expect(r.getByText('fora')).toBeTruthy();
  });
});
