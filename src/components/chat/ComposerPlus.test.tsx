// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ComposerPlus } from './ComposerPlus';
import type { ComposerSettingsProps } from './ComposerSettings';

afterEach(cleanup);

const base: ComposerSettingsProps = {
  mode: 'auto', setMode: vi.fn(), caps: null, bypass: false, setBypass: vi.fn(), model: 'sonnet',
  effort: 'low', setEffort: vi.fn(), skills: [], selectedSkills: [], setSelectedSkills: vi.fn(),
  mcpServers: [], selectedMcps: [], setSelectedMcps: vi.fn(), onRefreshModels: vi.fn(),
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
  it('lists attach and the Ajustes section with mode, effort', () => {
    open();
    expect(screen.getByRole('menuitem', { name: /Anexar arquivo/ })).toBeTruthy();
    expect(screen.getByText('Ajustes')).toBeTruthy();
    expect(screen.getByText('Planejar')).toBeTruthy();
    expect(screen.getByLabelText('Nível de pensamento do próximo prompt')).toBeTruthy();
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

  it('shows photo and dictation only on touch', () => {
    open();
    expect(screen.queryByRole('menuitem', { name: /Tirar foto/ })).toBeNull();
    cleanup();
    open({ touch: true });
    expect(screen.getByRole('menuitem', { name: /Tirar foto/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Ditar/ })).toBeTruthy();
  });

  it('gates the bypass switch on caps.canBypass', () => {
    open();
    expect(screen.queryByRole('switch')).toBeNull();
    cleanup();
    open({ settings: { caps: { canBypass: true } as never } });
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('hides skills, MCP and effort for ACP agents', () => {
    open({ settings: { model: 'agent:grok' } });
    expect(screen.queryByLabelText('Nível de pensamento do próximo prompt')).toBeNull();
  });
});
