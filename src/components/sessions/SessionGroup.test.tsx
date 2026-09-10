// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SessionGroup } from './SessionGroup';
import { RUNNING_LABEL, WAITING_LABEL } from './group-by-recency';

afterEach(cleanup);

describe('SessionGroup', () => {
  it('waiting group gets a violet left rule, not a tinted box', () => {
    render(<SessionGroup label={WAITING_LABEL} count={2}><div>linha</div></SessionGroup>);
    const box = screen.getByLabelText(WAITING_LABEL);
    expect(box.className).toContain('border-l-2');
    expect(box.className).toContain('border-violet-400/50');
    expect(box.className).not.toMatch(/bg-violet/);
  });

  it('running group gets a green left rule', () => {
    render(<SessionGroup label={RUNNING_LABEL} count={1}><div /></SessionGroup>);
    expect(screen.getByLabelText(RUNNING_LABEL).className).toContain('border-green-400/50');
  });

  it('date group has no section wrapper', () => {
    const { container } = render(<SessionGroup label="Hoje" count={1}><div /></SessionGroup>);
    expect(container.querySelector('section')).toBeNull();
  });
});
