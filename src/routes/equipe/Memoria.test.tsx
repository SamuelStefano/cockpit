// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { Memoria } from './Memoria';
import type { Memory, TeamBot } from '../../../shared/protocol';

afterEach(cleanup);
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

const bot = (id: string, name: string): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0 });
const bots = [bot('lia', 'Lia'), bot('red', 'Redator')];
const mem = (over: Partial<Memory> = {}): Memory => ({ id: 'm1', title: 'Voz da marca', body: 'Tom caloroso', agents: ['lia'], updatedAt: Date.now(), updatedBy: 'user', ...over });
const props = (memories: Memory[]) => ({ bots, memories, loaded: true, connected: true, onList: vi.fn(), onSave: vi.fn(), onDelete: vi.fn() });

describe('Memoria', () => {
  it('lists memories and opens the first one in the editor', () => {
    render(<Memoria {...props([mem(), mem({ id: 'm2', title: 'Produtos' })])} />);
    expect(screen.getByText('Produtos')).toBeTruthy();
    expect((screen.getByLabelText('Título da memória') as HTMLInputElement).value).toBe('Voz da marca');
    expect((screen.getByLabelText('Texto da memória') as HTMLTextAreaElement).value).toBe('Tom caloroso');
  });

  it('toggles who reads the memory', () => {
    const p = props([mem()]);
    render(<Memoria {...p} />);
    expect(screen.getByRole('button', { name: 'Lia' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Redator' }));
    expect(p.onSave).toHaveBeenCalledWith({ id: 'm1', title: 'Voz da marca', body: 'Tom caloroso', agents: ['lia', 'red'] });
    fireEvent.click(screen.getByRole('button', { name: 'Lia' }));
    expect(p.onSave).toHaveBeenLastCalledWith(expect.objectContaining({ agents: [] }));
  });

  it('autosaves typed text after a pause', () => {
    const p = props([mem()]);
    render(<Memoria {...p} />);
    fireEvent.change(screen.getByLabelText('Texto da memória'), { target: { value: 'Novo texto' } });
    expect(p.onSave).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(800); });
    expect(p.onSave).toHaveBeenCalledWith({ id: 'm1', title: 'Voz da marca', body: 'Novo texto', agents: ['lia'] });
  });

  it('warns when an agent reads more than 8 KB', () => {
    render(<Memoria {...props([mem({ body: 'x'.repeat(9000) })])} />);
    expect(screen.getByText(/Lia lê mais de 8 KB/)).toBeTruthy();
  });

  it('shows Claude memories read-only: no autosave, no delete, readers still assignable', () => {
    const p = props([mem({ fromDisk: true })]);
    render(<Memoria {...p} />);
    expect(screen.getByText('Memória do Claude (só leitura)')).toBeTruthy();
    expect((screen.getByLabelText('Texto da memória') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: 'Apagar memória' })).toBeNull();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(p.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Redator' }));
    expect(p.onSave).toHaveBeenCalledTimes(1);
  });

  it('asks before deleting', () => {
    const p = props([mem()]);
    render(<Memoria {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apagar memória' }));
    expect(p.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apagar mesmo' }));
    expect(p.onDelete).toHaveBeenCalledWith('m1');
  });

  it('creates a memory with an id the server accepts', () => {
    const p = props([]);
    render(<Memoria {...p} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Nova memória|Escrever a primeira/ })[0]);
    expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nova memória', agents: [], id: expect.stringMatching(/^m-/) }));
  });

  it('shows the import entry as disabled "em breve" and refuses a PDF', () => {
    render(<Memoria {...props([mem()])} />);
    expect((screen.getByRole('button', { name: /Importar/ }) as HTMLButtonElement).disabled).toBe(true);
    const input = screen.getByLabelText('Anexar arquivo de memória');
    fireEvent.change(input, { target: { files: [new File(['x'], 'guia.pdf')] } });
    expect(screen.getByRole('alert').textContent).toMatch(/em breve/);
  });
});
