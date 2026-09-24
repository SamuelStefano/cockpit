// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ContextEmpty } from './ContextEmpty';

afterEach(cleanup);

describe('ContextEmpty', () => {
  it('says the type filter is why nothing shows, and clears it', () => {
    const clear = vi.fn();
    const { getByText } = render(<ContextEmpty query="" filter="feedback" onClearFilter={clear} />);
    expect(getByText('Nenhum contexto do tipo feedback')).toBeTruthy();
    fireEvent.click(getByText('Ver todos'));
    expect(clear).toHaveBeenCalled();
  });

  it('keeps "Nenhum contexto ainda" for a truly empty list', () => {
    const { getByText } = render(<ContextEmpty query="" />);
    expect(getByText('Nenhum contexto ainda')).toBeTruthy();
  });
});
