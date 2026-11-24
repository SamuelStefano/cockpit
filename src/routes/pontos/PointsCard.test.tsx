// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { PointsCard } from './PointsCard';

afterEach(cleanup);

const entry = { id: 'e1', points: 5, description: 'bug fix', createdAt: 0, updatedAt: 0, history: [{ at: 0, by: 'you', kind: 'create', points: 5 }] } as never;

describe('PointsCard', () => {
  it('names the points button and reports the history toggle state', () => {
    const { getByRole } = render(<PointsCard entry={entry} now={0} glow={false} onCorrect={vi.fn()} onNote={vi.fn()} onDelete={vi.fn()} />);
    expect(getByRole('button', { name: 'Corrigir pontos (5 pt)' })).toBeTruthy();
    const hist = getByRole('button', { name: /histórico/ });
    expect(hist.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(hist);
    expect(hist.getAttribute('aria-expanded')).toBe('true');
  });
});
