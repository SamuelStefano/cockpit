// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { BotFilesApi } from '../equipe/equipe-props';
import { AgentWorkspace } from './AgentWorkspace';

afterEach(cleanup);

const now = Date.now();
const api = (over: Partial<BotFilesApi> = {}): BotFilesApi => ({
  botFiles: { capo1: [{ path: 'antigo.md', size: 10, mtime: now - 40 * 86_400_000 }, { path: 'mock/tela.png', size: 2048, mtime: now }] },
  botFileData: {},
  onBotFilesGet: vi.fn(),
  onBotFileGet: vi.fn(),
  ...over,
});

describe('AgentWorkspace', () => {
  it('lists files in the tree and asks for the listing', () => {
    const a = api();
    const r = render(<AgentWorkspace botId="capo1" api={a} connected />);
    expect(a.onBotFilesGet).toHaveBeenCalledWith('capo1');
    expect(r.getByLabelText('Hoje').textContent).toContain('tela.png');
    expect(r.getByText('Escolha um arquivo ao lado para ver o conteúdo.')).toBeTruthy();
  });

  it('shows the picked file in the viewer, re-reading it', () => {
    const a = api({ botFileData: { 'capo1:antigo.md': { status: 'ok', mime: 'text/markdown', size: 9, url: '', text: '**negrito**' } } });
    const r = render(<AgentWorkspace botId="capo1" api={a} connected />);
    fireEvent.click(r.getByText('antigo.md'));
    expect(a.onBotFileGet).toHaveBeenCalledWith('capo1', 'antigo.md', true);
    expect(r.getByText('negrito').tagName).toBe('STRONG');
    fireEvent.click(r.getByRole('button', { name: 'Fechar' }));
    expect(r.getByText('Escolha um arquivo ao lado para ver o conteúdo.')).toBeTruthy();
  });

  it('empty workspace says so', () => {
    const r = render(<AgentWorkspace botId="capo1" api={api({ botFiles: { capo1: [] } })} connected />);
    expect(r.getByText('Nenhum arquivo ainda')).toBeTruthy();
  });
});
