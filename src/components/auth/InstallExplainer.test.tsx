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
  it('states what the relay sees, by channel mode, without overclaiming', () => {
    const { container } = render(<RelayVisibility />);
    expect(screen.getByText('O que o relay vê')).toBeTruthy();
    const facts = RELAY_SEES.join(' ');
    expect(facts).toContain('canal selado');
    expect(facts).toContain('metadados');
    expect(facts).toContain('DECK_E2E=off');
    expect(container.textContent).toContain(RELAY_SOON);
  });
});
