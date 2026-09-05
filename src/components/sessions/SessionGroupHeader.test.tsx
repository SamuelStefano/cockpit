// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SessionGroupHeader } from './SessionGroupHeader';

afterEach(cleanup);

describe('SessionGroupHeader', () => {
  it('destaca "Aguardando você" no violeta do ponto de pergunta, com a contagem', () => {
    const { container } = render(<SessionGroupHeader label="Aguardando você" count={3} />);
    expect(screen.getByText('Aguardando você')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(container.querySelector('.text-violet-300')).toBeTruthy();
  });

  it('no modo inset larga o sticky e as margens negativas (fica dentro do bloco)', () => {
    const { container } = render(<SessionGroupHeader label="Aguardando você" count={1} inset />);
    const head = container.firstElementChild as HTMLElement;
    expect(head.className).not.toContain('sticky');
    expect(head.className).not.toContain('-mx-2.5');
  });

  it('mantém o grupo comum em cinza, sem ícone', () => {
    const { container } = render(<SessionGroupHeader label="Hoje" count={1} />);
    expect(container.querySelector('.text-neutral-500')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });
});
