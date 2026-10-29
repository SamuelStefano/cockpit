// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { FirstRunChecklist } from './FirstRunChecklist';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('FirstRunChecklist', () => {
  it('lists the three steps and lets the install one be ticked by hand', () => {
    render(<FirstRunChecklist providerConnected />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByText('Já fiz'));
    expect(screen.queryByText('Já fiz')).toBeNull();
  });

  it('disappears when every step is done', () => {
    localStorage.setItem('cockpit:onboardingSteps', JSON.stringify({ conversation: true, install: true }));
    const { container } = render(<FirstRunChecklist providerConnected />);
    expect(container.firstChild).toBeNull();
  });
});
