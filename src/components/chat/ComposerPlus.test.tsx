// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ComposerPlus } from './ComposerPlus';
import type { ComposerSettingsProps } from './ComposerSettings';

afterEach(cleanup);

const base: ComposerSettingsProps = {
  mode: 'auto', setMode: vi.fn(), caps: null, model: 'sonnet',
  effort: 'low', setEffort: vi.fn(),
  mcpServers: [], selectedMcps: [], setSelectedMcps: vi.fn(),
};
const mic = { listening: false, supported: true, toggle: vi.fn(), error: null };

function open(over: { touch?: boolean; onCall?: () => void; settings?: Partial<ComposerSettingsProps>; onAttach?: () => void } = {}) {
  render(
    <ComposerPlus
      touch={over.touch ?? false} mic={mic} onAttach={over.onAttach ?? vi.fn()} onPhoto={vi.fn()}
      onCall={over.onCall} settings={{ ...base, ...over.settings }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mais opções do composer' }));
}

describe('ComposerPlus', () => {
  it('lists attach, mode, think more and tools', () => {
    open();
    expect(screen.getByRole('menuitem', { name: /Anexar arquivo/ })).toBeTruthy();
    expect(screen.getByText('Planejar')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Pensar mais' })).toBeTruthy();
    expect(screen.getByText('Ferramentas')).toBeTruthy();
  });

  it('runs the action and closes the menu', () => {
    const onAttach = vi.fn();
    open({ onAttach });
    fireEvent.click(screen.getByRole('menuitem', { name: /Anexar arquivo/ }));
    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers the call only when supported', () => {
    open();
    expect(screen.queryByRole('menuitem', { name: /Ligar/ })).toBeNull();
    cleanup();
    const onCall = vi.fn();
    open({ onCall });
    fireEvent.click(screen.getByRole('menuitem', { name: /Ligar por voz/ }));
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it('shows photo only on touch', () => {
    open();
    expect(screen.queryByRole('menuitem', { name: /Tirar foto/ })).toBeNull();
    cleanup();
    open({ touch: true });
    expect(screen.getByRole('menuitem', { name: /Tirar foto/ })).toBeTruthy();
  });

  it('think more flips effort between low and high', () => {
    const setEffort = vi.fn();
    open({ settings: { setEffort } });
    fireEvent.click(screen.getByRole('switch', { name: 'Pensar mais' }));
    expect(setEffort).toHaveBeenCalledWith('high');
    cleanup();
    const back = vi.fn();
    open({ settings: { effort: 'high', setEffort: back } });
    expect(screen.getByRole('switch', { name: 'Pensar mais' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('switch', { name: 'Pensar mais' }));
    expect(back).toHaveBeenCalledWith('low');
  });

  it('tools submenu counts and toggles servers', () => {
    const setSelectedMcps = vi.fn();
    open({ settings: { mcpServers: ['a', 'b', 'c'], selectedMcps: ['a'], setSelectedMcps } });
    expect(screen.getByText('1 ligada')).toBeTruthy();
    fireEvent.click(screen.getByText('Ferramentas'));
    fireEvent.click(screen.getByRole('switch', { name: 'b' }));
    expect(setSelectedMcps).toHaveBeenCalledWith(['a', 'b']);
  });

  it('hides think more and tools for ACP agents', () => {
    open({ settings: { model: 'agent:grok' } });
    expect(screen.queryByRole('switch', { name: 'Pensar mais' })).toBeNull();
    expect(screen.queryByText('Ferramentas')).toBeNull();
  });

  it('gates the bypass switch on caps.canBypass and toggles it', () => {
    open();
    expect(screen.queryByRole('switch', { name: 'Bypass de permissões' })).toBeNull();
    cleanup();
    const setBypass = vi.fn();
    open({ settings: { caps: { canBypass: true } as never, bypass: false, setBypass } });
    fireEvent.click(screen.getByRole('switch', { name: 'Bypass de permissões' }));
    expect(setBypass).toHaveBeenCalledWith(true);
  });
});
