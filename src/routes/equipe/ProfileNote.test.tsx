// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ProfileNote } from './ProfileNote';

afterEach(cleanup);

describe('ProfileNote', () => {
  it('says "travado" and what the locked bot cannot do', () => {
    const { container } = render(<ProfileNote profile="restricted" />);
    expect(container.textContent).toContain('Perfil:');
    expect(container.textContent).toContain('travado');
    expect(container.textContent).toMatch(/Sem terminal/);
  });
  it('a full bot is labelled completo', () => {
    expect(render(<ProfileNote profile="full" />).container.textContent).toContain('completo');
  });
});
