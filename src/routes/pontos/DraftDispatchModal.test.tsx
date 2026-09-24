// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DraftDispatchModal } from './DraftDispatchModal';

afterEach(cleanup);

const draft = { id: 'ep-1', title: 'Épico', status: 'draft', deliveries: [{ id: 'dl-1', title: 'D', taskIds: ['t1'] }], tasks: [{ id: 't1', title: 'T', points: 2, status: 'draft', refs: [] }] } as never;

describe('DraftDispatchModal', () => {
  it('states the price per point the DFL deliveries will be created at, and where it comes from', () => {
    const { getByText } = render(<DraftDispatchModal request={{ title: 'Criar épico no DFL', units: [{ draft, kind: 'epic' } as never] }} pointValue={90} busy={false} onConfirm={vi.fn()} onClose={vi.fn()} />);
    const line = getByText(/Preço das deliveries criadas/);
    expect(line.textContent).toContain('R$ 90,00/pt');
    expect(line.textContent).toContain('deste navegador');
  });
});
