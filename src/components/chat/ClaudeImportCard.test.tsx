// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ClaudeImportApi } from '../../cockpit/useClaudeImport';
import { ClaudeImportCard } from './ClaudeImportCard';

afterEach(cleanup);

function api(over: Partial<ClaudeImportApi> = {}): ClaudeImportApi {
  return { scan: null, hint: null, result: null, busy: false, onScan: vi.fn(), onApply: vi.fn(), onMsg: vi.fn(), ...over };
}

describe('ClaudeImportCard', () => {
  it('previews the typed path', () => {
    const a = api();
    render(<ClaudeImportCard api={a} />);
    fireEvent.change(screen.getByLabelText('Caminho do .claude'), { target: { value: '/x/.claude' } });
    fireEvent.click(screen.getByText('Pré-visualizar'));
    expect(a.onScan).toHaveBeenCalledWith('/x/.claude');
  });

  it('applies only the checked kinds and counts new items', () => {
    const a = api({ scan: { source: '/x/.claude', found: true, skills: [{ name: 'a', exists: false }, { name: 'b', exists: true }], mcps: [{ name: 'gh', exists: false, needsFill: ['TOKEN'] }], memory: [] } });
    render(<ClaudeImportCard api={a} />);
    expect(screen.getByText('MCP gh: precisa preencher TOKEN')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Importe seus MCPs' }));
    fireEvent.click(screen.getByText('Importar 1 item'));
    expect(a.onApply).toHaveBeenCalledWith(['memory', 'skills'], '');
  });

  it('explains the isolated user and shows the copy command when unreadable', () => {
    render(<ClaudeImportCard api={api({ scan: { source: '/home/t/.claude', found: false, reason: 'unreadable', skills: [], mcps: [], memory: [] }, hint: 'sudo cp -r x y' })} />);
    expect(screen.getByText(/usuário isolado/)).toBeTruthy();
    expect(screen.getByText('sudo cp -r x y')).toBeTruthy();
  });
});
