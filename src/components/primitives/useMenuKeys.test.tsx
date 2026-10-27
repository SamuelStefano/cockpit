// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ComposerPlus } from '../chat/ComposerPlus';
import type { ComposerSettingsProps } from '../chat/ComposerSettings';

afterEach(cleanup);

const mic = { listening: false, supported: true, toggle: vi.fn(), error: null } as never;
const settings: ComposerSettingsProps = {
  mode: 'auto', setMode: vi.fn(), caps: null, bypass: false, setBypass: vi.fn(), model: 'sonnet',
  effort: 'low', setEffort: vi.fn(), skills: [], selectedSkills: [], setSelectedSkills: vi.fn(),
  mcpServers: [], selectedMcps: [], setSelectedMcps: vi.fn(), onRefreshModels: vi.fn(),
};
const plus = () => <ComposerPlus touch mic={mic} onAttach={vi.fn()} onPhoto={vi.fn()} onCall={vi.fn()} settings={settings} />;
const TRIGGER = 'Mais opções do composer';

describe('useMenuKeys (composer + menu)', () => {
  it('focuses the first item on open and moves with the arrows, wrapping', () => {
    const { getByRole, getAllByRole } = render(plus());
    fireEvent.click(getByRole('button', { name: TRIGGER }));
    const items = getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowUp' });
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(getByRole('menu'), { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('gives focus back to the trigger when the menu closes', async () => {
    const { getByRole, queryByRole } = render(plus());
    const trigger = getByRole('button', { name: TRIGGER });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
