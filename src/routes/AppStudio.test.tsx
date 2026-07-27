// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AppStudio } from './AppStudio';

describe('AppStudio', () => {
  it('monta o Button de verdade do design system, não uma cópia', async () => {
    const code = 'export default function App() { return <Button variant="primary">salvar</Button>; }';
    const { container } = render(<AppStudio code={code} />);
    // btn-jewel só existe no primitivo real: se aparecer, o escopo está ligado
    // no componente do app e não numa reimplementação do sandbox.
    await waitFor(() => expect(container.querySelector('.btn-jewel')).toBeTruthy());
    expect(container.textContent).toContain('salvar');
  });

  it('contém o erro de render em vez de derrubar a rota', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = 'export default function App() { throw new Error("quebrou de proposito"); }';
    const { container } = render(<AppStudio code={code} />);
    await waitFor(() => expect(container.textContent).toContain('quebrou de proposito'));
    quiet.mockRestore();
  });

  it('mostra o erro de sintaxe sem tentar montar nada', async () => {
    const { container } = render(<AppStudio code={'export default function App() { return <div>' } />);
    await waitFor(() => expect(container.querySelector('.text-red-400')).toBeTruthy());
  });
});
