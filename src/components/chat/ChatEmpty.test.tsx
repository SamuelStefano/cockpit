// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

const touch = vi.hoisted(() => ({ virtual: false }));
vi.mock('./touch', () => ({ isVirtualKeyboardOnly: () => touch.virtual, isTouchMobile: () => touch.virtual }));

import { ChatEmpty } from './ChatEmpty';

afterEach(cleanup);

describe('ChatEmpty suggestion rows', () => {
  it('send on desktop', () => {
    touch.virtual = false;
    const onPrompt = vi.fn(); const onSeed = vi.fn();
    const { getByText } = render(<ChatEmpty onPrompt={onPrompt} onSeed={onSeed} />);
    fireEvent.click(getByText(/Escrever um rascunho/));
    expect(onPrompt).toHaveBeenCalled();
    expect(onSeed).not.toHaveBeenCalled();
  });

  it('only fill the composer on a phone', () => {
    touch.virtual = true;
    const onPrompt = vi.fn(); const onSeed = vi.fn();
    const { getByText } = render(<ChatEmpty onPrompt={onPrompt} onSeed={onSeed} />);
    fireEvent.click(getByText(/Escrever um rascunho/));
    expect(onSeed).toHaveBeenCalledWith(expect.stringContaining('Escrever um rascunho'));
    expect(onPrompt).not.toHaveBeenCalled();
  });
});

describe('ChatEmpty deck-guide entry', () => {
  it('fills the composer with the deck-guide prompt and never sends it', () => {
    touch.virtual = false;
    const onPrompt = vi.fn(); const onSeed = vi.fn();
    const { getByText } = render(<ChatEmpty onPrompt={onPrompt} onSeed={onSeed} />);
    fireEvent.click(getByText('Pergunte ao Deck como configurar'));
    expect(onSeed).toHaveBeenCalledWith(expect.stringContaining('deck-guide'));
    expect(onPrompt).not.toHaveBeenCalled();
  });
});

describe('ChatEmpty layout', () => {
  it('shows exactly three chips and renders the composer between question and chips', () => {
    touch.virtual = false;
    const { getAllByRole, getByText } = render(<ChatEmpty onPrompt={vi.fn()}><div>composer</div></ChatEmpty>);
    expect(getAllByRole('button')).toHaveLength(3);
    expect(getByText('composer')).toBeTruthy();
    expect(getByText('O que vamos trabalhar hoje?')).toBeTruthy();
  });

  it('has no mascot and renders rows without borders', () => {
    const { container, getAllByRole } = render(<ChatEmpty onPrompt={vi.fn()} />);
    expect(container.querySelector('[data-bit]')).toBeNull();
    for (const b of getAllByRole('button')) {
      expect(b.className).not.toMatch(/\bborder\b/);
      expect(b.querySelector('svg')).toBeTruthy();
    }
  });
});

describe('ChatEmpty provider hint', () => {
  it('shows nothing when a provider is ready', () => {
    const { queryByText } = render(<ChatEmpty onPrompt={vi.fn()} />);
    expect(queryByText('Conectar um provedor')).toBeNull();
  });

  it('links to /onboarding when no provider is ready', () => {
    const push = vi.spyOn(history, 'pushState');
    const { getByText } = render(<ChatEmpty onPrompt={vi.fn()} needsProvider />);
    fireEvent.click(getByText('Conectar um provedor'));
    expect(push).toHaveBeenCalledWith(null, '', '/onboarding');
  });
});

describe('ChatEmpty compact', () => {
  it('renders only the composer while the keyboard is open', () => {
    const { queryByText, getByText } = render(<ChatEmpty compact onPrompt={vi.fn()}><div>composer</div></ChatEmpty>);
    expect(getByText('composer')).toBeTruthy();
    expect(queryByText(/O que vamos trabalhar/)).toBeNull();
    expect(queryByText(/Escrever um rascunho/)).toBeNull();
  });
});
