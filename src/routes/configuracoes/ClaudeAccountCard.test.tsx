// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ClaudeAccountCard } from './ClaudeAccountCard';
import type { ClaudeAccount } from '../../../shared/protocol';

afterEach(cleanup);

const account = { loggedIn: true, email: 'someone.with.a.long.name@example-company.com', orgName: 'Example Organization Ltd' } as ClaudeAccount;

describe('ClaudeAccountCard', () => {
  it('exposes the full identity in titles and stacks the buttons on phone', () => {
    const noop = vi.fn();
    render(<ClaudeAccountCard account={account} login={{ state: 'idle' }} onGet={noop} onLogout={noop} onLoginStart={noop} onLoginCode={noop} onLoginCancel={noop} />);
    expect(screen.getByTitle(account.email!)).toBeTruthy();
    expect(screen.getByTitle(account.orgName!).className).toContain('truncate');
    expect(screen.getByRole('button', { name: 'Trocar conta' }).parentElement!.className).toContain('max-sm:w-full');
  });
});
