// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SessionGroup } from './SessionGroup';
import { RUNNING_LABEL, WAITING_LABEL } from './group-by-recency';

afterEach(cleanup);

describe('SessionGroup', () => {
  it('renders the label and children with no left rule', () => {
    render(<SessionGroup label={WAITING_LABEL}><div>linha</div></SessionGroup>);
    const box = screen.getByLabelText(WAITING_LABEL);
    expect(box.className).not.toContain('border-l');
    expect(screen.getByText('linha')).toBeTruthy();
  });

  it('running and date groups share the same label style', () => {
    render(<><SessionGroup label={RUNNING_LABEL}><div /></SessionGroup><SessionGroup label="Hoje"><div /></SessionGroup></>);
    expect(screen.getByText(RUNNING_LABEL).className).toContain('text-[12px]');
    expect(screen.getByText('Hoje').className).toContain('text-[13px]');
  });
});
