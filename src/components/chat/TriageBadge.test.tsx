// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { TriageBadge } from './TriageBadge';

afterEach(cleanup);

describe('TriageBadge', () => {
  it('shows why on tap, not only in a hover title', () => {
    const { getByRole, queryByText, getByText } = render(<TriageBadge action="wait" reason="o turno ainda está editando arquivos" />);
    expect(queryByText(/Por quê: o turno/)).toBeNull();
    fireEvent.click(getByRole('button', { name: /na fila/ }));
    expect(getByText(/Por quê: o turno ainda está editando arquivos/)).toBeTruthy();
  });
});
