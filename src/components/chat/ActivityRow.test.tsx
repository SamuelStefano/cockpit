// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { ActivityRow } from './ActivityRow';
import type { ToolCall } from '../../data/types';

afterEach(cleanup);

const tool = (over: Partial<ToolCall>): ToolCall =>
  ({ id: 'x', name: 'Bash', label: 'Bash', command: 'ls', status: 'done', output: [], ...over });

describe('ActivityRow', () => {
  it('is a closed single line when the turn is done', () => {
    render(<ActivityRow tools={[tool({ id: '1', durationMs: 2100 })]} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.textContent).toContain('Rodou 1 comando');
    expect(screen.queryByText(/ok, 2.1s/)).toBeNull();
  });

  it('opens by default while a tool runs and lists status per item', () => {
    render(<ActivityRow tools={[tool({ id: '1', durationMs: 2100 }), tool({ id: '2', command: 'validar', status: 'running' })]} />);
    expect(screen.getAllByRole('button')[0].getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/ok, 2.1s/)).toBeTruthy();
    expect(screen.getByText(/rodando…/)).toBeTruthy();
  });

  it('lets the user toggle it', () => {
    render(<ActivityRow tools={[tool({ id: '1' })]} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText('ls')).toBeTruthy();
  });
});
