// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

vi.mock('../components/Chat', () => ({ ChatPanel: ({ onTerminal }: { onTerminal?: () => void }) => <div>chat<button onClick={onTerminal}>abrir</button></div> }));
vi.mock('../components/Terminals', () => ({ TerminalsPanel: ({ onCloseMobile }: { onCloseMobile?: () => void }) => <div>terminais<button onClick={onCloseMobile}>fechar</button></div> }));

import { DesktopLayout, type DesktopLayoutProps } from './DesktopLayout';

afterEach(cleanup);

const base: DesktopLayoutProps = {
  chatProps: {} as never, termProps: {} as never, rowRef: { current: null },
};

describe('DesktopLayout', () => {
  it('starts with the terminals closed and opens them on request', () => {
    render(<DesktopLayout {...base} />);
    expect(screen.getByText('chat')).toBeTruthy();
    expect(screen.queryByText('terminais')).toBeNull();
    fireEvent.click(screen.getByText('abrir'));
    expect(screen.getByText('terminais')).toBeTruthy();
    fireEvent.click(screen.getByText('fechar'));
    expect(screen.queryByText('terminais')).toBeNull();
  });

  it('puts an agent thread in the chat slot and lets its profile push the terminals aside', () => {
    render(<DesktopLayout {...base} center={<div>agente</div>} hideTerminals />);
    expect(screen.getByText('agente')).toBeTruthy();
    expect(screen.queryByText('chat')).toBeNull();
    expect(screen.queryByText('terminais')).toBeNull();
  });
});
