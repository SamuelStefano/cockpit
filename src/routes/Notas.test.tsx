// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Notas } from './Notas';

afterEach(cleanup);

const props = { connected: true, notes: 'uma ideia', notesLoaded: true, onNotesGet: vi.fn(), onNotesSave: vi.fn(), onAnalyze: vi.fn() };

describe('Notas', () => {
  it('takes two taps to wipe the note', () => {
    const { getByRole, container } = render(<Notas {...props} />);
    fireEvent.click(getByRole('button', { name: 'Limpar' }));
    expect(container.querySelector('textarea')!.value).toBe('uma ideia');
    fireEvent.click(getByRole('button', { name: 'Confirmar: apagar a nota' }));
    expect(container.querySelector('textarea')!.value).toBe('');
  });

  it('uses the singular for one word and one line', () => {
    const { getByText } = render(<Notas {...props} notes="ideia" />);
    expect(getByText('1 palavra · 1 linha')).toBeTruthy();
  });
});
