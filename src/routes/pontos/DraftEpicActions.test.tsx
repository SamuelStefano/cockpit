// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DraftEpicActions } from './DraftEpicActions';

afterEach(cleanup);

describe('DraftEpicActions "voltar a rascunho"', () => {
  it('needs a second tap, since the next "criar" would send every task to DFL again', () => {
    const resetStatus = vi.fn();
    const e = { progress: 'done', pending: 0, armed: false, createAll: vi.fn(), clickDelete: vi.fn(), resetStatus } as never;
    const { getByText } = render(<DraftEpicActions e={e} onAddDelivery={vi.fn()} />);
    fireEvent.click(getByText('voltar a rascunho'));
    expect(resetStatus).not.toHaveBeenCalled();
    fireEvent.click(getByText('voltar tudo? recria no DFL'));
    expect(resetStatus).toHaveBeenCalledTimes(1);
  });
});
