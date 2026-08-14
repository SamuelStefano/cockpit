// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SessionGroupHeader } from './SessionGroupHeader';

afterEach(cleanup);

describe('SessionGroupHeader', () => {
  it('destaca "Aguardando você" no laranja de ação com a contagem', () => {
    const { container } = render(<SessionGroupHeader label="Aguardando você" count={3} />);
    expect(screen.getByText('Aguardando você')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(container.querySelector('.text-orange-400\\/90')).toBeTruthy();
  });

  it('mantém o grupo comum em cinza, sem ícone', () => {
    const { container } = render(<SessionGroupHeader label="Hoje" count={1} />);
    expect(container.querySelector('.text-neutral-500')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });
});
