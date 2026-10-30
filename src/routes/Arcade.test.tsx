// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Arcade } from './Arcade';

describe('Arcade screen', () => {
  beforeEach(() => localStorage.clear());

  it('shows level, game and secrets with the typing hint', () => {
    render(<Arcade />);
    expect(document.body.textContent).toContain('Nv 1');
    expect(screen.getByRole('img', { name: /Bit Runner/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Comandos secretos/ }));
    expect(screen.getByText(/fora de campos de texto/)).toBeTruthy();
  });
});
