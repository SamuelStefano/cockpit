// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { EffortColumn } from './EffortColumn';

afterEach(cleanup);

describe('EffortColumn', () => {
  it('renders five radios with the current one checked', () => {
    render(<EffortColumn effort="high" setEffort={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(radios.filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.textContent)).toEqual(['Alto']);
  });

  it('calls setEffort when a level is clicked', () => {
    const setEffort = vi.fn();
    render(<EffortColumn effort="low" setEffort={setEffort} />);
    fireEvent.click(screen.getByRole('radio', { name: /Máximo/ }));
    expect(setEffort).toHaveBeenCalledWith('max');
  });

  it('tags the default level', () => {
    render(<EffortColumn effort="max" setEffort={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /Baixo/ }).textContent).toContain('padrão');
    expect(screen.getAllByText('padrão')).toHaveLength(1);
  });
});
