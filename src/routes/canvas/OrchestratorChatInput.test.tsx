// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { OrchestratorChatInput } from './OrchestratorChatInput';

afterEach(cleanup);

describe('OrchestratorChatInput history', () => {
  it('recalls the last prompt on the first ArrowUp even after a duplicate send', () => {
    const { container } = render(<OrchestratorChatInput onSend={vi.fn()} />);
    const ta = container.querySelector('textarea')!;
    for (const t of ['um', 'um']) {
      fireEvent.change(ta, { target: { value: t } });
      fireEvent.keyDown(ta, { key: 'Enter' });
    }
    fireEvent.keyDown(ta, { key: 'ArrowUp' });
    expect(ta.value).toBe('um');
  });
});
