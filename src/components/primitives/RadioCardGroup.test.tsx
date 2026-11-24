// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { RadioCardGroup } from './RadioCardGroup';

afterEach(cleanup);

function Harness() {
  const [v, setV] = useState<'a' | 'b'>('a');
  return (
    <RadioCardGroup label="modo" value={v} onChange={setV} items={[
      { id: 'a', title: 'um', description: 'desc a', icon: 'shield' },
      { id: 'b', title: 'dois', description: 'desc b', icon: 'terminal' },
    ]} />
  );
}

describe('RadioCardGroup', () => {
  it('is one tab stop and arrows move the selection', () => {
    const { getAllByRole, getByRole } = render(<Harness />);
    expect(getAllByRole('radio').map((r) => r.tabIndex)).toEqual([0, -1]);
    fireEvent.keyDown(getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(getAllByRole('radio')[1].getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(getAllByRole('radio')[1]);
  });
});
