// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { CanvasNode } from '../../../shared/canvas';
import { CanvasAnalysis } from './CanvasAnalysis';

afterEach(cleanup);

const node: CanvasNode = { id: 's:a', kind: 'session', ref: 'a', title: 'portfolio game jam', subtitle: '', mtime: 0 };

describe('CanvasAnalysis on a phone', () => {
  it('drops the RAM column and the model tag below sm so the session title keeps its width', () => {
    const { getByText, getByRole } = render(
      <CanvasAnalysis nodes={[node]} stats={{ a: { cpu: 10, rssMb: 320, procs: 1, model: 'claude-opus-5-5' } }} running={new Set()} onPick={vi.fn()} onClose={vi.fn()} />,
    );
    expect(getByText('ram').className).toMatch(/\bhidden\b.*\bsm:inline\b/);
    expect(getByText('320MB').className).toMatch(/\bhidden\b.*\bsm:inline\b/);
    expect(getByText('opus-5-5').className).toMatch(/\bhidden\b.*\bsm:inline\b/);
    // Header and rows share the same responsive template, or the columns drift apart.
    const row = getByRole('button', { name: /portfolio game jam/ });
    expect(row.className).toContain('grid-cols-[1fr_4.5rem_3rem_4rem]');
    expect(getByText('sessão').parentElement?.className).toContain('grid-cols-[1fr_4.5rem_3rem_4rem]');
    expect(row.getAttribute('title')).toBe('portfolio game jam');
  });
});
