// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { BotFiles } from './BotFiles';
import type { BotFilesApi } from './equipe-props';

afterEach(cleanup);

const now = Date.now();
const api = (over: Partial<BotFilesApi> = {}): BotFilesApi => ({
  botFiles: { capo1: [
    { path: 'antigo.md', size: 10, mtime: now - 40 * 86_400_000 },
    { path: 'mock/tela.png', size: 2048, mtime: now },
  ] },
  botFileData: {},
  onBotFilesGet: vi.fn(),
  onBotFileGet: vi.fn(),
  ...over,
});

describe('BotFiles', () => {
  it('asks for the listing and groups it newest first', () => {
    const a = api();
    const r = render(<BotFiles botId="capo1" api={a} connected />);
    expect(a.onBotFilesGet).toHaveBeenCalledWith('capo1');
    expect(r.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Hoje', 'Antes']);
    expect(r.getByLabelText('Hoje').textContent).toContain('tela.png');
    expect(r.getByLabelText('Antes').textContent).toContain('antigo.md');
  });

  it('opens an image preview, re-reading the file', () => {
    const a = api({ botFileData: { 'capo1:mock/tela.png': { status: 'ok', mime: 'image/png', size: 3, url: 'data:image/png;base64,cG5n' } } });
    const r = render(<BotFiles botId="capo1" api={a} connected />);
    fireEvent.click(r.getByText('tela.png'));
    expect(a.onBotFileGet).toHaveBeenCalledWith('capo1', 'mock/tela.png', true);
    expect((r.getByAltText('mock/tela.png') as HTMLImageElement).src).toBe('data:image/png;base64,cG5n');
  });

  it('renders markdown and shows a server refusal', () => {
    const a = api({ botFileData: { 'capo1:antigo.md': { status: 'ok', mime: 'text/markdown', size: 9, url: '', text: '**negrito**' } } });
    const r = render(<BotFiles botId="capo1" api={a} connected />);
    fireEvent.click(r.getByText('antigo.md'));
    expect(r.getByText('negrito').tagName).toBe('STRONG');
    cleanup();
    const b = api({ botFileData: { 'capo1:antigo.md': { status: 'error', error: 'arquivo passa de 10MB' } } });
    const r2 = render(<BotFiles botId="capo1" api={b} connected />);
    fireEvent.click(r2.getByText('antigo.md'));
    expect(r2.getByText('arquivo passa de 10MB')).toBeTruthy();
  });

  it('empty workspace says so', () => {
    const r = render(<BotFiles botId="capo1" api={api({ botFiles: { capo1: [] } })} connected />);
    expect(r.getByText('Nenhum arquivo ainda')).toBeTruthy();
  });
});
