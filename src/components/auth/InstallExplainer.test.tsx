// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { InstallExplainer } from './InstallExplainer';
import { RelayVisibility } from './RelayVisibility';
import { DRY_RUN_ENV, SETUP_SOURCE_URL, RELAY_SEES, RELAY_SOON } from './install-facts';

afterEach(cleanup);

describe('install facts match the real script', () => {
  const script = readFileSync(`${process.cwd()}/scripts/agent-setup.sh`, 'utf8');

  it('uses the dry-run variable the script reads', () => {
    expect(script).toContain(`"\${${DRY_RUN_ENV.split('=')[0]}:-}"`);
  });

  it('links to the script path that exists in the repo', () => {
    expect(SETUP_SOURCE_URL.endsWith('/scripts/agent-setup.sh')).toBe(true);
  });
});

describe('InstallExplainer', () => {
  it('explains the command, the dry-run and links the source', () => {
    render(<InstallExplainer mode="isolated" />);
    expect(screen.getByText('O que este comando faz')).toBeTruthy();
    expect(screen.getByText(DRY_RUN_ENV)).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe(SETUP_SOURCE_URL);
  });

  it('describes the active mode', () => {
    render(<InstallExplainer mode="dedicated" />);
    expect(screen.getByText(/Seu usuário: instala no seu HOME/)).toBeTruthy();
  });
});

describe('RelayVisibility', () => {
  it('states what the relay sees and never claims end-to-end encryption', () => {
    const { container } = render(<RelayVisibility />);
    expect(screen.getByText('O que o relay vê')).toBeTruthy();
    expect(RELAY_SEES.join(' ')).toContain('sem criptografia ponta a ponta');
    expect(container.textContent).toContain('em breve');
    expect(RELAY_SOON).not.toMatch(/criptografad/i);
  });
});
