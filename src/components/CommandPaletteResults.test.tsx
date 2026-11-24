// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CommandPaletteResults, PALETTE_LIST_ID, paletteOptionId } from './CommandPaletteResults';

afterEach(cleanup);

const cmd = (id: string, group: string) => ({ id, label: id, icon: 'zap', group, run: vi.fn() }) as never;

describe('CommandPaletteResults', () => {
  it('is a listbox of options with the highlighted one selected and addressable by id', () => {
    const { getByRole, getAllByRole } = render(
      <CommandPaletteResults filtered={[cmd('a', 'Ir'), cmd('b', 'Ir')]} sel={1} setSel={vi.fn()} />,
    );
    expect(getByRole('listbox').id).toBe(PALETTE_LIST_ID);
    const opts = getAllByRole('option');
    expect(opts).toHaveLength(2);
    expect(opts[1].getAttribute('aria-selected')).toBe('true');
    expect(opts[1].id).toBe(paletteOptionId(1));
  });
});
