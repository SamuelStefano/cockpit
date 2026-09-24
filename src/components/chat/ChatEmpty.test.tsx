// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

const touch = vi.hoisted(() => ({ virtual: false }));
vi.mock('./touch', () => ({ isVirtualKeyboardOnly: () => touch.virtual, isTouchMobile: () => touch.virtual }));

import { ChatEmpty } from './ChatEmpty';

afterEach(cleanup);

describe('ChatEmpty topic cards', () => {
  it('send on desktop', () => {
    touch.virtual = false;
    const onPrompt = vi.fn(); const onSeed = vi.fn();
    const { getByText } = render(<ChatEmpty onPrompt={onPrompt} onSeed={onSeed} />);
    fireEvent.click(getByText(/Analisa os logs/));
    expect(onPrompt).toHaveBeenCalled();
    expect(onSeed).not.toHaveBeenCalled();
  });

  it('only fill the composer on a phone', () => {
    touch.virtual = true;
    const onPrompt = vi.fn(); const onSeed = vi.fn();
    const { getByText } = render(<ChatEmpty onPrompt={onPrompt} onSeed={onSeed} />);
    fireEvent.click(getByText(/Analisa os logs/));
    expect(onSeed).toHaveBeenCalledWith(expect.stringContaining('Analisa os logs'));
    expect(onPrompt).not.toHaveBeenCalled();
  });
});
