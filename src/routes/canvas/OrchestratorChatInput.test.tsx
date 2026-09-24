// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { OrchestratorChatInput } from './OrchestratorChatInput';

afterEach(cleanup);

describe('OrchestratorChatInput history', () => {
  it('recalls the last prompt on the first ArrowUp even after a duplicate send', () => {
    const { container } = render(<OrchestratorChatInput onSend={vi.fn(() => true)} />);
    const ta = container.querySelector('textarea')!;
    for (const t of ['um', 'um']) {
      fireEvent.change(ta, { target: { value: t } });
      fireEvent.keyDown(ta, { key: 'Enter' });
    }
    fireEvent.keyDown(ta, { key: 'ArrowUp' });
    expect(ta.value).toBe('um');
  });
});

describe('OrchestratorChatInput send', () => {
  it('keeps the text when nothing went out (socket down)', () => {
    const { container } = render(<OrchestratorChatInput onSend={() => false} />);
    const ta = container.querySelector('textarea')!;
    fireEvent.change(ta, { target: { value: 'um prompt longo' } });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(ta.value).toBe('um prompt longo');
  });

  it('clears it once sent', () => {
    const { container } = render(<OrchestratorChatInput onSend={() => true} />);
    const ta = container.querySelector('textarea')!;
    fireEvent.change(ta, { target: { value: 'ok' } });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(ta.value).toBe('');
  });
});
