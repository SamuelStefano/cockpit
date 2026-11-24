// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { OverCapNotice } from './OverCapNotice';

afterEach(cleanup);

describe('OverCapNotice', () => {
  it('names the tasks the split would move before the click', () => {
    const { getByText } = render(<OverCapNotice overCents={50000} capCents={500000} canSplit onSplit={vi.fn()} moving={['Relatório', 'Export CSV']} />);
    expect(getByText(/vai pro épico novo: 2 tasks — Relatório · Export CSV/)).toBeTruthy();
  });
});
