// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Segmented } from './Segmented';

afterEach(cleanup);

function Harness() {
  const [v, setV] = useState<'a' | 'b' | 'c'>('a');
  return <Segmented label="filtro" value={v} onChange={setV} items={[{ id: 'a', label: 'um' }, { id: 'b', label: 'dois' }, { id: 'c', label: 'três' }]} />;
}

describe('Segmented', () => {
  it('is one tab stop and the arrows move the selection, wrapping', () => {
    const { getAllByRole, getByRole } = render(<Harness />);
    const radios = getAllByRole('radio');
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    fireEvent.keyDown(getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(getByRole('radio', { name: 'dois' }).getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(getByRole('radio', { name: 'dois' }));
    fireEvent.keyDown(getByRole('radiogroup'), { key: 'ArrowLeft' });
    fireEvent.keyDown(getByRole('radiogroup'), { key: 'ArrowLeft' });
    expect(getByRole('radio', { name: 'três' }).getAttribute('aria-checked')).toBe('true');
  });
});
