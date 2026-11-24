// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { CanvasNode } from '../../../shared/canvas';
import type { TermApi } from '../../useCockpit';

vi.mock('../../components/Xterm', () => ({ XtermView: () => null }));
import { TerminalMaximized } from './TerminalMaximized';

afterEach(cleanup);

const node: CanvasNode = { id: 's:a', kind: 'session', ref: 'a', title: 'Deck audit marathon', subtitle: '', mtime: 0 };

describe('TerminalMaximized header', () => {
  it('gives the session title priority over the tmux id on a narrow screen', () => {
    const { getByText } = render(
      <TerminalMaximized node={node} target={{ termId: 'w-00000001aaaa4bbb8ccc1000' }} term={{} as TermApi} onClose={vi.fn()} />,
    );
    const tmux = getByText(/tmux cockpit-w-/);
    expect(tmux.className).toMatch(/\bhidden\b.*\bsm:inline\b/);
    expect(tmux.className).toContain('truncate');
    expect(getByText('Deck audit marathon').getAttribute('title')).toBe('Deck audit marathon');
  });
});
