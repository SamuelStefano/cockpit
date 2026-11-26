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

  it('students see no edit controls', () => {
    const a = api({ botFileData: { 'capo1:antigo.md': { status: 'ok', mime: 'text/markdown', size: 2, url: '', text: 'oi' } }, onBotFilePut: vi.fn(() => true) });
    const r = render(<AgentWorkspace botId="capo1" api={a} connected />);
    fireEvent.click(r.getByText('antigo.md'));
    expect(r.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(r.queryByRole('button', { name: 'Novo arquivo' })).toBeNull();
  });

  it('admin edits, marks dirty and saves with Ctrl+S and the base mtime', () => {
    const put = vi.fn(() => true);
    const a = api({ botFileData: { 'capo1:antigo.md': { status: 'ok', mime: 'text/markdown', size: 2, url: '', text: 'oi' } }, onBotFilePut: put, botFileSaves: {} });
    const r = render(<AgentWorkspace botId="capo1" api={a} connected canEdit />);
    fireEvent.click(r.getByText('antigo.md'));
    fireEvent.click(r.getByRole('button', { name: 'Editar' }));
    const box = r.getByLabelText('Editar antigo.md');
    fireEvent.change(box, { target: { value: 'oi de novo' } });
    expect(r.getByLabelText('Alterações não salvas')).toBeTruthy();
    fireEvent.keyDown(box, { key: 's', ctrlKey: true });
    expect(put).toHaveBeenCalledWith('capo1', 'antigo.md', 'oi de novo', now - 40 * 86_400_000);
  });

  it('shows the conflict copy when the server refuses', () => {
    const put = vi.fn(() => true);
    const base = { botFileData: { 'capo1:antigo.md': { status: 'ok' as const, mime: 'text/markdown', size: 2, url: '', text: 'oi' } }, onBotFilePut: put };
    const r = render(<AgentWorkspace botId="capo1" api={api({ ...base, botFileSaves: {} })} connected canEdit />);
    fireEvent.click(r.getByText('antigo.md'));
    fireEvent.click(r.getByRole('button', { name: 'Editar' }));
    fireEvent.change(r.getByLabelText('Editar antigo.md'), { target: { value: 'x' } });
    fireEvent.click(r.getByRole('button', { name: 'Salvar' }));
    r.rerender(<AgentWorkspace botId="capo1" api={api({ ...base, botFileSaves: { 'capo1:antigo.md': { status: 'saving' } } })} connected canEdit />);
    r.rerender(<AgentWorkspace botId="capo1" api={api({ ...base, botFileSaves: { 'capo1:antigo.md': { status: 'error', error: 'conflito' } } })} connected canEdit />);
    expect(r.getByRole('alert').textContent).toBe('O arquivo mudou desde que você abriu. Recarregue antes de salvar.');
  });

  it('creates a new .md file without a base mtime', () => {
    const put = vi.fn(() => true);
    const r = render(<AgentWorkspace botId="capo1" api={api({ onBotFilePut: put, botFileSaves: {} })} connected canEdit />);
    fireEvent.click(r.getByRole('button', { name: 'Novo arquivo' }));
    fireEvent.change(r.getByLabelText('Nome do novo arquivo'), { target: { value: 'notas' } });
    fireEvent.click(r.getByRole('button', { name: 'Criar' }));
    fireEvent.change(r.getByLabelText('Editar notas.md'), { target: { value: '# notas' } });
    fireEvent.click(r.getByRole('button', { name: 'Salvar' }));
    expect(put).toHaveBeenCalledWith('capo1', 'notas.md', '# notas', undefined);
  });
});
