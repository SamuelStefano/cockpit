// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ImageResolverContext } from '../primitives';
import { ProposalCard } from './ProposalCard';

afterEach(cleanup);

const options = [{ label: 'Aprovar', recommended: true }, { label: 'Cortar', recommended: false }];
const base = { question: 'O que faço?', options, open: true, picked: null, inTeam: true, onPick: vi.fn() };

describe('ProposalCard', () => {
  it('renders no image and no deadline line when both are absent', () => {
    const r = render(<ProposalCard {...base} />);
    expect(r.container.querySelector('img')).toBeNull();
    expect(r.container.textContent).toContain('Recomendo A. Responda com a letra ou escreva outra ideia.');
    expect(r.container.textContent).not.toContain('eu seguro a rodada');
  });
  it('says when the bot holds the round', () => {
    const r = render(<ProposalCard {...base} deadline="10:30" />);
    expect(r.container.textContent).toContain('Se ninguém responder até 10:30, eu seguro a rodada.');
  });
  it('shows the picture through the workspace resolver', () => {
    const resolver = { get: () => ({ status: 'ok' as const, url: 'blob:x' }), request: vi.fn() };
    const r = render(<ImageResolverContext.Provider value={resolver}><ProposalCard {...base} image="mock.png" /></ImageResolverContext.Provider>);
    expect(r.container.querySelector('img')?.getAttribute('src')).toBe('blob:x');
  });
  it('falls back to a link for an https image without a resolver', () => {
    const r = render(<ProposalCard {...base} image="https://example.com/a.png" />);
    expect(r.container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/a.png');
  });
});
