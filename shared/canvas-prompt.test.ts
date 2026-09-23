import { describe, it, expect } from 'vitest';
import type { CanvasNode } from './canvas';
import { CARD_MARKER_RE } from './canvas';
import { buildContentPrompt, buildTaskPrompt } from './canvas-prompt';

const ctx: CanvasNode = { id: 'c:hub_deck', kind: 'context', ref: 'hub_deck', title: 'hub-deck', subtitle: '', mtime: 1, path: '/m/hub_deck.md' };
const ses: CanvasNode = { id: 's:abc', kind: 'session', ref: 'abc', title: 'Fila', subtitle: 'corrigiu a fila', mtime: 1 };

describe('buildTaskPrompt', () => {
  it('lists sources and ends with the card marker', () => {
    const p = buildTaskPrompt({ id: 'card-1', title: 'Canvas', prompt: 'faça X' }, [ctx], [ses]);
    expect(p).toContain('/m/hub_deck.md');
    expect(p).toContain('`abc`');
    expect(CARD_MARKER_RE.exec(p)?.[1]).toBe('card-1');
    expect(p.trimEnd().endsWith('[deck-card:card-1]')).toBe(true);
  });

  it('falls back to the title when the prompt is empty', () => {
    expect(buildTaskPrompt({ id: 'card-1', title: 'Só título', prompt: ' ' }, [], [])).toContain('\nSó título\n');
  });
});

describe('buildContentPrompt', () => {
  it('writes to a dated slug and forbids publishing', () => {
    const p = buildContentPrompt({ id: 'card-2', title: 'Semana do Deck!', prompt: '' }, 'post', [ctx], [], '2026-09-23');
    expect(p).toContain('~/deck-content/2026-09-23-semana-do-deck.md');
    expect(p).toContain('não publique');
    expect(CARD_MARKER_RE.exec(p)?.[1]).toBe('card-2');
  });
});
