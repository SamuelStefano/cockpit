import { loadPref } from '../../lib/persist';

const HELPER_URL = 'https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/deck-ssh-install.mjs';

export function sshOnboardingEnabled(): boolean {
  return loadPref<boolean>('flag.sshOnboarding', false) === true;
}

export function sshInstallCommand(code: string): string {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(code)) return '';
  return `curl -fsSL ${HELPER_URL} | DECK_SSH_ONBOARDING=1 DECK_PAIR_CODE=${code} node - user@host`;
}
