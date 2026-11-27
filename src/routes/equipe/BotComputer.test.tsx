// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { BotComputer as BotComputerData, TeamBot } from '../../../shared/protocol';
import type { TermApi } from '../../cockpit/useTerminals';
import type { BotComputerApi } from './equipe-props';
import type { BotState } from '../../components/team/botState';
import { BotComputerProvider } from './computer-context';
import { BotComputer } from './BotComputer';

vi.mock('../../components/Xterm', () => ({
  XtermView: ({ id, botId }: { id: string; botId?: string }) => <div data-testid="xterm">{id}:{botId}</div>,
}));

afterEach(cleanup);

const bot = { id: 'capo1', name: 'Capo', profile: 'restricted' } as TeamBot;
const computer: BotComputerData = { cwd: '~/.cockpit/bots/capo1/workspace', files: 3, bytes: 2048, truncated: false, termId: 'bot-capo1', termAlive: false, preview: [] };
const api = (c: Partial<BotComputerData> | null = {}): BotComputerApi => ({
  botComputers: c ? { capo1: { status: 'ok', computer: { ...computer, ...c } } } : {},
  onBotComputerGet: vi.fn(),
});
const term = {} as TermApi;

function renderTab(over: { isAdmin?: boolean; connected?: boolean; state?: BotState; computer?: Partial<BotComputerData> | null } = {}) {
  const a = api(over.computer === undefined ? {} : over.computer);
  const state = over.state ?? 'idle';
  const r = render(
    <BotComputerProvider bot={bot} state={state} api={a} term={term} connected={over.connected ?? true} isAdmin={over.isAdmin ?? true} isMobile={false}>
      <BotComputer bot={bot} state={state} />
    </BotComputerProvider>,
  );
  return { ...r, api: a };
}

describe('BotComputer', () => {
  it('is not a stub: shows the machine, cwd, disk, state and Assumir', () => {
    const r = renderTab({ state: 'working' });
    expect(r.api.onBotComputerGet).toHaveBeenCalledWith('capo1');
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
    const r = renderTab({ computer: { termAlive: true, preview: ['$ ls', 'notas.md'] } });
    expect(r.getByLabelText('Prévia do terminal').textContent).toBe('$ ls\nnotas.md');
  });

  it('Assumir opens the terminal fullscreen in the bot workspace, Soltar gives it back', async () => {
    const r = renderTab();
    fireEvent.click(r.getByRole('button', { name: 'Assumir' }));
    expect(r.getByRole('dialog', { name: 'Computador de Capo' })).toBeTruthy();
    expect((await r.findByTestId('xterm')).textContent).toBe('bot-capo1:capo1');
    fireEvent.click(r.getByRole('button', { name: 'Soltar' }));
    expect(r.queryByTestId('xterm')).toBeNull();
    expect(r.queryByRole('dialog', { name: 'Computador de Capo' })).toBeNull();
    expect(r.api.onBotComputerGet).toHaveBeenCalledTimes(2);
  });

  it('only an admin can take over', () => {
    const r = renderTab({ isAdmin: false });
    const assumir = r.getByRole('button', { name: 'Assumir' }) as HTMLButtonElement;
    expect(assumir.disabled).toBe(true);
    expect(r.getByText('Só admin assume o terminal.')).toBeTruthy();
    fireEvent.click(assumir);
    expect(r.queryByTestId('xterm')).toBeNull();
    expect(r.queryByRole('dialog')).toBeNull();
  });

  it('does not paint pane lines for a student even if the payload has them', () => {
    const r = renderTab({ isAdmin: false, computer: { termAlive: true, preview: ['sk-secret'] } });
    expect(r.queryByText('sk-secret')).toBeNull();
  });

  it('says what failed instead of a blank tab', () => {
    const a: BotComputerApi = { botComputers: { capo1: { status: 'error', error: 'bot não encontrado' } }, onBotComputerGet: vi.fn() };
    const r = render(
      <BotComputerProvider bot={bot} state="idle" api={a} term={term} connected isAdmin isMobile={false}>
        <BotComputer bot={bot} state="idle" />
      </BotComputerProvider>,
    );
    expect(r.getByText(/bot não encontrado/)).toBeTruthy();
  });
});
