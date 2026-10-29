// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SshInstallHint } from './SshInstallHint';

describe('SshInstallHint', () => {
  it('shows the command with the code', () => {
    render(<SshInstallHint code="ABCD1234" />);
    expect(screen.getByText(/DECK_PAIR_CODE=ABCD1234/)).toBeTruthy();
  });
  it('renders nothing without a code', () => {
    const { container } = render(<SshInstallHint code="" />);
    expect(container.firstChild).toBeNull();
  });
});
