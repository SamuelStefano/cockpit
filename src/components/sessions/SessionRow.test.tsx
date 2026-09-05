// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SessionRow } from './SessionRow';
import type { Session } from '../../data/types';

afterEach(cleanup);

const s: Session = {
  id: 'a', title: 'Nova sessão', relative: '14s', snippet: 'Pegue o contexto',
  mtime: Date.now(), hasTerminal: false, active: false,
};

const row = (props: Partial<Parameters<typeof SessionRow>[0]>) => {
  const { container } = render(
    <SessionRow s={s} active onSelect={() => {}} onRename={() => {}} onClose={() => {}} {...props} />,
  );
  return (container.firstElementChild as HTMLElement).className;
};

describe('SessionRow selecionada', () => {
  it('fora de bloco usa o aro laranja de acento', () => {
    const cls = row({});
    expect(cls).toContain('border-orange-500/40');
    expect(cls).toContain('glow-active');
  });

  it('dentro do bloco de estado larga aro e halo (não briga com a borda do bloco)', () => {
    const cls = row({ inGroup: true });
    expect(cls).not.toContain('border-orange-500/40');
    expect(cls).not.toContain('glow-active');
    expect(cls).toContain('bg-neutral-100/8');
  });
});
