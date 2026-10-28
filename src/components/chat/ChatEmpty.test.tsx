// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

const touch = vi.hoisted(() => ({ virtual: false }));
vi.mock('./touch', () => ({ isVirtualKeyboardOnly: () => touch.virtual, isTouchMobile: () => touch.virtual }));

import { ChatEmpty } from './ChatEmpty';

afterEach(cleanup);

describe('ChatEmpty suggestion chips', () => {
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

describe('ChatEmpty layout', () => {
  it('shows exactly three chips and renders the composer between question and chips', () => {
    touch.virtual = false;
    const { getAllByRole, getByText } = render(<ChatEmpty onPrompt={vi.fn()}><div>composer</div></ChatEmpty>);
    expect(getAllByRole('button')).toHaveLength(3);
    expect(getByText('composer')).toBeTruthy();
    expect(getByText('Em que vamos trabalhar?')).toBeTruthy();
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
