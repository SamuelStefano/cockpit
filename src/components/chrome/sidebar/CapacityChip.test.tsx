// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';
import { boxStore } from '../../../cockpit/boxes-store';
import { CapacityChip } from './CapacityChip';

const A = '11111111-1111-4111-8111-111111111111';

beforeEach(() => { localStorage.clear(); boxStore.reset(); });
afterEach(cleanup);

describe('CapacityChip', () => {
  it('shows live/cap with the memory tooltip, named after the active box', () => {
    render(<CapacityChip capacity={{ live: 2, cap: 3, configCap: 12, availMb: 1200 }} />);
    act(() => { boxStore.setPref(A); boxStore.applyFrame({ t: 'boxes', box: null, primary: A, boxes: [{ id: A, label: 'VPS', online: true, lastSeen: null }] }); });
    const chip = screen.getByRole('status');
    expect(chip.textContent).toBe('2/3');
    expect(chip.getAttribute('aria-label')).toBe('VPS: 2 de 3 vagas. Memória limita a 3.');
  });

  it('falls back to a generic name without relay boxes', () => {
    render(<CapacityChip capacity={{ live: 1, cap: 3, configCap: 3, availMb: 3000 }} />);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Esta máquina: 1 de 3 vagas. Limite configurado: 3.');
  });
});
