// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TermApi } from '../cockpit/useTerminals';
import { typedCommand } from '../cockpit/agent-terminal';
import { useAgentTerminal } from './useAgentTerminal';

const makeTerm = () => ({ input: vi.fn(() => true) }) as unknown as TermApi & { input: ReturnType<typeof vi.fn> };

describe('useAgentTerminal', () => {
  it('opens the terminal and types the command only once the PTY speaks', () => {
    const term = makeTerm();
    const { result } = renderHook(() => useAgentTerminal(term, 'agent-grok', vi.fn()));
    act(() => result.current.run('install', 'npm i -g x'));
    expect(result.current.open).toBe(true);
    expect(result.current.running).toEqual({ kind: 'install', command: 'npm i -g x' });
    expect(term.input).not.toHaveBeenCalled();
    act(() => result.current.onOutput('$ ', false));
    expect(term.input).toHaveBeenCalledWith('agent-grok', typedCommand('npm i -g x'));
  });

  it('ends the step when the marker prints, and reports which step', () => {
    const term = makeTerm();
    const onEnd = vi.fn();
    const { result } = renderHook(() => useAgentTerminal(term, 'agent-grok', onEnd));
    act(() => result.current.onOutput('old screen [deck] passo terminou (0)', true));
    act(() => result.current.run('login', 'grok login'));
    expect(term.input).toHaveBeenCalledTimes(1);
    act(() => result.current.onOutput('[deck] passo terminou (0)', true));
    expect(onEnd).not.toHaveBeenCalled();
    act(() => result.current.onOutput('\r\n[deck] passo terminou (0)\r\n', false));
    expect(onEnd).toHaveBeenCalledWith('login');
    expect(result.current.running).toBeNull();
  });

  it('lets the person close the step by hand, once', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useAgentTerminal(makeTerm(), 't', onEnd));
    act(() => result.current.run('login', 'gemini'));
    act(() => result.current.finish());
    act(() => result.current.finish());
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('forgets readiness when hidden, so a reopen waits for the PTY again', () => {
    const term = makeTerm();
    const { result } = renderHook(() => useAgentTerminal(term, 't', vi.fn()));
    act(() => result.current.onOutput('$ ', false));
    act(() => result.current.hide());
    expect(result.current.open).toBe(false);
    act(() => result.current.run('install', 'x'));
    expect(term.input).not.toHaveBeenCalled();
    act(() => result.current.onOutput('', true));
    expect(term.input).toHaveBeenCalledTimes(1);
  });
});
