// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { BotComputer as BotComputerData, TeamBot } from '../../../shared/protocol';
import type { ChatBotDecor, ChatPanelProps } from '../../components/chat/chat-panel-props';
import type { TermApi } from '../../cockpit/useTerminals';
import type { BotComputerApi } from './equipe-props';
import { BotComputerProvider } from './computer-context';
import { BotThread } from './BotThread';
import type { BotView } from './team-view';

// The header lives in the ChatPanel now: the stub renders what BotThread hands it.
vi.mock('../../components/Chat', () => ({
  ChatPanel: ({ botDecor }: { botDecor?: ChatBotDecor }) => <div><span>chat</span>{botDecor?.header?.actions}</div>,
}));
vi.mock('../../components/Xterm', () => ({
  XtermView: ({ id, botId }: { id: string; botId?: string }) => <div data-testid="xterm">{id}:{botId}</div>,
}));

afterEach(cleanup);

const bot = { id: 'capo1', name: 'Capo', label: '', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', createdAt: 0, updatedAt: 0 } as TeamBot;
const view: BotView = { bot, key: 'bot-capo1', preview: '', unread: false, state: 'working' };
const computer: BotComputerData = { cwd: '~/.cockpit/bots/capo1/workspace', files: 1, bytes: 10, truncated: false, termId: 'bot-capo1', termAlive: true, preview: ['$ ls', 'sk-secret'] };

function renderThread(isAdmin = true) {
  const api: BotComputerApi = { botComputers: { capo1: { status: 'ok', computer } }, onBotComputerGet: vi.fn() };
  const chatProps = { messages: [], session: null, onQuote: vi.fn() } as unknown as ChatPanelProps;
  return render(
    <BotComputerProvider bot={bot} state="working" api={api} term={{} as TermApi} connected isAdmin={isAdmin} isMobile={false}>
      <BotThread view={view} chatProps={chatProps} bots={[bot]} log={[]} files={{ botFileData: {}, onBotFileGet: vi.fn() }} />
    </BotComputerProvider>,
  );
}

describe('BotThread computer levels', () => {
  it('shows a purple status icon and opens a preview without leaving the chat', () => {
    const r = renderThread();
    expect(r.getByText('chat')).toBeTruthy();
    const status = r.getByRole('button', { name: 'Computador ativo' });
    expect(status.className).toMatch(/violet/);
    fireEvent.click(status);
    expect(r.getByLabelText('Prévia do computador')).toBeTruthy();
    expect(r.getByText('chat')).toBeTruthy();
    expect(r.getByLabelText('Prévia do terminal').textContent).toContain('$ ls');
  });

  it('does not paint pane lines for a student in the docked preview', () => {
    const r = renderThread(false);
    fireEvent.click(r.getByRole('button', { name: 'Computador ativo' }));
    expect(r.queryByText('sk-secret')).toBeNull();
    expect(r.queryByText('$ ls')).toBeNull();
    expect(r.queryByLabelText('Prévia do terminal')).toBeNull();
    const assumir = r.getByRole('button', { name: 'Assumir' }) as HTMLButtonElement;
    expect(assumir.disabled).toBe(true);
    fireEvent.click(assumir);
    expect(r.queryByTestId('xterm')).toBeNull();
    expect(r.queryByRole('dialog')).toBeNull();
  });
});
