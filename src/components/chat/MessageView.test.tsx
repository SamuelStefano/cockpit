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

  it('falls back to the Claude avatar', () => {
    const { container } = render(<MessageRow msg={msg} caretOnLast={false} modelLabel="Sonnet" />);
    expect(screen.queryByTestId('bot-avatar')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
