// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { sshInstallCommand, sshOnboardingEnabled } from './ssh-install';

describe('ssh-install', () => {
  beforeEach(() => localStorage.clear());

  it('is off by default and on with the flag', () => {
    expect(sshOnboardingEnabled()).toBe(false);
    localStorage.setItem('cockpit:flag.sshOnboarding', 'true');
    expect(sshOnboardingEnabled()).toBe(true);
  });

  it('fills the code and refuses unsafe ones', () => {
    expect(sshInstallCommand('ABCD-1234')).toContain('DECK_PAIR_CODE=ABCD-1234 node - user@host');
    expect(sshInstallCommand('x; rm -rf /')).toBe('');
    expect(sshInstallCommand('')).toBe('');
  });
});
