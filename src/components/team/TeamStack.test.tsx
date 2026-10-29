// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TeamStack } from './TeamStack';
import type { BotView } from '../../routes/equipe/team-view';

afterEach(cleanup);
beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('coarse'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as never;
});

const view = (id: string, over: Partial<BotView> = {}): BotView => ({
  bot: { id, name: id.toUpperCase(), mascot: { shape: 'drop', color: '#22c55e' } } as BotView['bot'], key: id, preview: `frase ${id}`, unread: false, state: 'idle', ...over,
});

function setup(views: BotView[], canManage = true) {
  const props = { views, activeId: null, onOpen: vi.fn(), onNew: vi.fn(), onGo: vi.fn(), canManage };
  render(<TeamStack {...props} />);
  return props;
}

describe('TeamStack', () => {
  it('renders nothing with no agents', () => {
    const { container } = render(<TeamStack views={[]} activeId={null} onOpen={vi.fn()} onNew={vi.fn()} onGo={vi.fn()} canManage />);
    expect(container.textContent).toBe('');
  });

  it('shows 3 mascots and +N', () => {
    setup(['a', 'b', 'c', 'd', 'e'].map((id) => view(id)));
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });

  it('flags a waiting agent on the trigger', () => {
    setup([view('a', { pending: { botId: 'a' } as never })]);
    expect(screen.getByRole('button', { name: 'Equipe, 1 esperando você' })).toBeTruthy();
  });

  it('opens the sheet with phrases and the exits', () => {
    const p = setup([view('a'), view('b')]);
    fireEvent.click(screen.getByRole('button', { name: /^Equipe/ }));
    expect(screen.getByRole('dialog', { name: 'Equipe' })).toBeTruthy();
    expect(screen.getByText('frase b')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Novo agente' }));
    expect(p.onNew).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /^Equipe/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    expect(p.onGo).toHaveBeenCalledWith('/equipe/rotinas');
    fireEvent.click(screen.getByRole('button', { name: /^Equipe/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Memória' }));
    expect(p.onGo).toHaveBeenCalledWith('/equipe/memoria');
  });

  it('hides Novo agente from students', () => {
    setup([view('a')], false);
    fireEvent.click(screen.getByRole('button', { name: /^Equipe/ }));
    expect(screen.queryByRole('button', { name: 'Novo agente' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rotinas' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Memória' })).toBeNull();
  });
});
