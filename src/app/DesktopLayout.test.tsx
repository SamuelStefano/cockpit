// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

vi.mock('../components/Chat', () => ({ ChatPanel: () => <div>chat</div> }));
vi.mock('../components/Terminals', () => ({ TerminalsPanel: () => <div>terminais</div> }));

import { DesktopLayout, type DesktopLayoutProps } from './DesktopLayout';

afterEach(cleanup);

const base: DesktopLayoutProps = {
  chatProps: {} as never, termProps: {} as never, rowRef: { current: null }, rightW: 30,
  rightCollapsed: false, setRightCollapsed: vi.fn(), startDrag: () => vi.fn(), nudge: vi.fn(),
};

describe('DesktopLayout', () => {
  it('is the thread plus the terminals, with no sessions column', () => {
    render(<DesktopLayout {...base} />);
    expect(screen.getByText('chat')).toBeTruthy();
    expect(screen.getByText('terminais')).toBeTruthy();
    expect(screen.queryByLabelText('Largura do painel de sessões')).toBeNull();
  });

  it('puts an agent thread in the chat slot and lets its profile push the terminals aside', () => {
    render(<DesktopLayout {...base} center={<div>agente</div>} hideTerminals />);
    expect(screen.getByText('agente')).toBeTruthy();
    expect(screen.queryByText('chat')).toBeNull();
    expect(screen.queryByText('terminais')).toBeNull();
  });
});
