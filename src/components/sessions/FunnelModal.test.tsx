// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { FunnelModal } from './FunnelModal';
import type { Session } from '../../data/types';

afterEach(cleanup);

const now = 100 * 86_400_000;
const s = (id: string, title: string): Session => ({ id, title, relative: '', snippet: '', mtime: now - 10 * 86_400_000, hasTerminal: false, active: false });
const candidates = [s('a', 'Vagas'), s('b', 'Sobre mim'), s('c', 'Inglês')];

const mount = (excluded: Set<string>, onToggle = vi.fn(), onRun = vi.fn()) => {
  const selected = candidates.filter((c) => !excluded.has(c.id)).map((c) => c.id);
  render(<FunnelModal open onClose={() => {}} candidates={candidates} excluded={excluded} onToggle={onToggle} selected={selected} idleDays={7} setIdleDays={() => {}} now={now} onRun={onRun} />);
  return { onToggle, onRun };
};

describe('FunnelModal', () => {
  it('every candidate starts checked and the button counts all of them', () => {
    mount(new Set());
    expect(screen.getAllByRole('checkbox').every((c) => c.getAttribute('aria-checked') === 'true')).toBe(true);
    expect(screen.getByText('Destilar e arquivar 3')).toBeTruthy();
  });

  it('unchecked rows are excluded from the run and the count', () => {
    const { onRun } = mount(new Set(['b']));
    expect(screen.getByText('Destilar e arquivar 2')).toBeTruthy();
    expect(screen.getByText(/1 desmarcada fica como está/)).toBeTruthy();
    fireEvent.click(screen.getByText('Destilar e arquivar 2'));
    expect(onRun).toHaveBeenCalledWith(['a', 'c']);
  });

  it('clicking a row toggles it', () => {
    const { onToggle } = mount(new Set());
    fireEvent.click(screen.getByText('Sobre mim'));
    expect(onToggle).toHaveBeenCalledWith('b');
  });

  it('nothing selected disables the run', () => {
    mount(new Set(['a', 'b', 'c']));
    expect((screen.getByText('Destilar e arquivar 0').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
