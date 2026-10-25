// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageRow } from './MessageView';

const msg = { id: 'a1', role: 'assistant' as const, blocks: [{ type: 'text' as const, md: 'oi' }], ts: 1 };

describe('MessageRow identity', () => {
  it('speaks as a bot when given its avatar and name', () => {
    render(<MessageRow msg={msg} caretOnLast={false} modelLabel="growth-lead" avatar={<span data-testid="bot-avatar" />} />);
    expect(screen.getByTestId('bot-avatar')).toBeTruthy();
    expect(screen.getByText('growth-lead')).toBeTruthy();
  });

  it('falls back to a frozen Bit on an old bubble', () => {
    const { container } = render(<MessageRow msg={msg} caretOnLast={false} modelLabel="Sonnet" />);
    expect(screen.queryByTestId('bot-avatar')).toBeNull();
    expect(container.querySelector('svg.bit.bit-idle.bit-still')).toBeTruthy();
  });

  it('animates the Bit of the live bubble with the turn state', () => {
    const { container } = render(<MessageRow msg={msg} caretOnLast modelLabel="Sonnet" bit="talking" />);
    const bit = container.querySelector('svg.bit');
    expect(bit?.classList.contains('bit-talking')).toBe(true);
    expect(bit?.classList.contains('bit-still')).toBe(false);
  });

  it('keeps the agent name label next to the Bit', () => {
    render(<MessageRow msg={msg} caretOnLast={false} modelLabel="Grok" bit="idle" />);
    expect(screen.getByText('Grok')).toBeTruthy();
  });
});
