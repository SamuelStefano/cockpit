// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { CollapsedRail } from './CollapsedRail';

afterEach(cleanup);

describe('CollapsedRail', () => {
  it('is wide enough to tap and re-expands on click', () => {
    const onExpand = vi.fn();
    render(<CollapsedRail side="left" label="Sessões" icon="message" onExpand={onExpand} />);
    const btn = screen.getByLabelText('Mostrar Sessões');
    expect(btn.className).toContain('w-11');
    fireEvent.click(btn);
    expect(onExpand).toHaveBeenCalled();
  });
});
