// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SlashPalette, SLASH_LIST_ID, slashOptionId } from './SlashPalette';

afterEach(cleanup);

describe('SlashPalette', () => {
  it('is a listbox whose highlighted option is selected and addressable', () => {
    const { getByRole, getAllByRole } = render(<SlashPalette matches={['help', 'new']} sel={0} setSel={vi.fn()} complete={vi.fn()} />);
    expect(getByRole('listbox').id).toBe(SLASH_LIST_ID);
    const opts = getAllByRole('option');
    expect(opts[0].getAttribute('aria-selected')).toBe('true');
    expect(opts[0].id).toBe(slashOptionId(0));
    expect(opts[1].getAttribute('aria-selected')).toBe('false');
  });
});
