// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RunForm } from './RunForm';

afterEach(cleanup);

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('RunForm', () => {
  it('submits the trimmed job and clears the command', () => {
    const onRun = vi.fn();
    render(<RunForm canEdit configured onRun={onRun} />);
    expect(screen.getByRole('button', { name: 'Rodar no executor' }).hasAttribute('disabled')).toBe(true);
    fill('Repositório', ' org/app ');
    fill('Branch', 'feat/x');
    fill('Comando', 'npm test ');
    fireEvent.click(screen.getByRole('button', { name: 'Rodar no executor' }));
    expect(onRun).toHaveBeenCalledWith({ repo: 'org/app', branch: 'feat/x', command: 'npm test' });
    expect((screen.getByLabelText('Comando') as HTMLInputElement).value).toBe('');
  });
  it('sends the optional folder when given', () => {
    const onRun = vi.fn();
    render(<RunForm canEdit configured onRun={onRun} />);
    fill('Repositório', 'a/b'); fill('Branch', 'main'); fill('Pasta (opcional)', 'web'); fill('Comando', 'ls');
    fireEvent.click(screen.getByRole('button', { name: 'Rodar no executor' }));
    expect(onRun).toHaveBeenCalledWith({ repo: 'a/b', branch: 'main', dir: 'web', command: 'ls' });
  });
  it('is disabled with the reason for non-admins and when not configured', () => {
    const onRun = vi.fn();
    render(<RunForm canEdit={false} configured onRun={onRun} />);
    expect(screen.getByRole('status').textContent).toContain('Só o admin');
    expect(screen.getByLabelText('Comando').matches(':disabled')).toBe(true);
    cleanup();
    render(<RunForm canEdit configured={false} onRun={onRun} />);
    expect(screen.getByRole('status').textContent).toContain('não está configurado');
    expect(screen.getByRole('button', { name: 'Rodar no executor' }).hasAttribute('disabled')).toBe(true);
    expect(onRun).not.toHaveBeenCalled();
  });
});
