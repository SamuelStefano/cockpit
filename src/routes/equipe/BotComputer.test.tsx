// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { BotComputer as BotComputerData, TeamBot } from '../../../shared/protocol';
import type { TermApi } from '../../cockpit/useTerminals';
import type { BotComputerApi } from './equipe-props';

vi.mock('../../components/Xterm', () => ({
  XtermView: ({ id, botId }: { id: string; botId?: string }) => <div data-testid="xterm">{id}:{botId}</div>,
}));

import { BotComputer } from './BotComputer';

afterEach(cleanup);

const bot = { id: 'capo1', name: 'Capo', profile: 'restricted' } as TeamBot;
const computer: BotComputerData = { cwd: '~/.cockpit/bots/capo1/workspace', files: 3, bytes: 2048, truncated: false, termId: 'bot-capo1', termAlive: false, preview: [] };
const api = (c: Partial<BotComputerData> | null = {}): BotComputerApi => ({
  botComputers: c ? { capo1: { status: 'ok', computer: { ...computer, ...c } } } : {},
  onBotComputerGet: vi.fn(),
});
const term = {} as TermApi;

describe('BotComputer', () => {
  it('is not a stub: shows the machine, cwd, disk, state and Assumir', () => {
    const a = api();
    const r = render(<BotComputer bot={bot} state="working" api={a} term={term} connected isAdmin />);
    expect(a.onBotComputerGet).toHaveBeenCalledWith('capo1');
    expect(r.queryByText('Em breve')).toBeNull();
    expect(r.getByText('Esta máquina')).toBeTruthy();
    expect(r.getByText('~/.cockpit/bots/capo1/workspace')).toBeTruthy();
    expect(r.getByText('3 arquivos · 2 KB')).toBeTruthy();
    expect(r.getByText('Trabalhando')).toBeTruthy();
    expect(r.getByText(/Perfil travado/)).toBeTruthy();
    expect(r.getByText(/Nenhum terminal aberto/)).toBeTruthy();
    expect((r.getByRole('button', { name: 'Assumir' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the pane preview when the bot terminal exists', () => {
    const r = render(<BotComputer bot={bot} state="idle" api={api({ termAlive: true, preview: ['$ ls', 'notas.md'] })} term={term} connected isAdmin />);
    expect(r.getByLabelText('Prévia do terminal').textContent).toBe('$ ls\nnotas.md');
  });

  it('Assumir opens the terminal in the bot workspace, Soltar gives it back', async () => {
    const a = api();
    const r = render(<BotComputer bot={bot} state="idle" api={a} term={term} connected isAdmin />);
    fireEvent.click(r.getByRole('button', { name: 'Assumir' }));
    expect((await r.findByTestId('xterm')).textContent).toBe('bot-capo1:capo1');
    fireEvent.click(r.getByRole('button', { name: 'Soltar' }));
    expect(r.queryByTestId('xterm')).toBeNull();
    expect(a.onBotComputerGet).toHaveBeenCalledTimes(2);
  });

  it('only an admin can take over', () => {
    const r = render(<BotComputer bot={bot} state="idle" api={api()} term={term} connected isAdmin={false} />);
    expect((r.getByRole('button', { name: 'Assumir' }) as HTMLButtonElement).disabled).toBe(true);
    expect(r.getByText('Só admin assume o terminal.')).toBeTruthy();
  });

  it('says what failed instead of a blank tab', () => {
    const a: BotComputerApi = { botComputers: { capo1: { status: 'error', error: 'bot não encontrado' } }, onBotComputerGet: vi.fn() };
    const r = render(<BotComputer bot={bot} state="idle" api={a} term={term} connected isAdmin />);
    expect(r.getByText(/bot não encontrado/)).toBeTruthy();
  });
});
