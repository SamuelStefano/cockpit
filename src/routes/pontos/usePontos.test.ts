// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PointsEntry } from '../../../shared/protocol';
import { usePontos } from './usePontos';

const toasts: { text: string; tone?: string }[] = [];
vi.mock('../../components/primitives', () => ({
  toast: (text: string, opts?: { tone?: string }) => { toasts.push({ text, tone: opts?.tone }); },
}));

const entry = (id: string): PointsEntry => ({
  entryId: id, title: 't', points: 1, originalPoints: 1, createdAt: 0, updatedAt: 0,
  by: 'user', history: [], corrected: false, deleted: false,
} as unknown as PointsEntry);

const args = (over: Partial<Parameters<typeof usePontos>[0]> = {}) => ({
  connected: true,
  points: [] as PointsEntry[],
  loaded: true,
  onPointsGet: vi.fn(),
  onPointsAdd: vi.fn(() => true),
  onPointsCorrect: vi.fn(() => true),
  onPointsNote: vi.fn(() => true),
  onPointsDelete: vi.fn(() => true),
  ...over,
});

beforeEach(() => { toasts.length = 0; });

describe('usePontos', () => {
  it('escrita descartada pelo socket vira erro, não confirmação', () => {
    const { result } = renderHook(() => usePontos(args({ onPointsAdd: vi.fn(() => false) })));
    act(() => { result.current.add('x', 2); });
    expect(toasts[0].tone).toBe('error');
    expect(toasts[0].text).not.toContain('Registrado');
  });

  it('escrita que saiu confirma', () => {
    const { result } = renderHook(() => usePontos(args()));
    act(() => { result.current.add('x', 2); });
    expect(toasts[0].text).toContain('Registrado');
    expect(toasts[0].tone).toBeUndefined();
  });

  it('o primeiro snapshot carregado não acende o glow da lista inteira', () => {
    const { result, rerender } = renderHook((p: { points: PointsEntry[]; loaded: boolean }) => usePontos(args(p)), {
      initialProps: { points: [] as PointsEntry[], loaded: false },
    });
    rerender({ points: [entry('a'), entry('b')], loaded: true });
    expect(result.current.glowing.size).toBe(0);
    rerender({ points: [entry('a'), entry('b'), entry('c')], loaded: true });
    expect([...result.current.glowing]).toEqual(['c']);
  });
});
