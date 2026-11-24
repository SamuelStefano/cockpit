// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NewMeetingForm } from './NewMeetingForm';
import { bot, bots } from './meetings.fixtures';

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof NewMeetingForm>[0]> = {}) => {
  const onStart = vi.fn();
  render(<NewMeetingForm bots={bots} canEdit onStart={onStart} onCancel={vi.fn()} {...over} />);
  return onStart;
};
const chip = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) });
const submit = () => screen.getByRole('button', { name: 'Abrir reunião' }) as HTMLButtonElement;

describe('NewMeetingForm', () => {
  it('groups participants by department', () => {
    setup();
    expect(screen.getByRole('group', { name: 'Engenharia' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Growth' })).toBeTruthy();
  });

  it('stays disabled until there is a question and 2 participants, saying why', () => {
    setup();
    expect(submit().disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Escreva a pergunta');
    fireEvent.change(screen.getByLabelText(/Pergunta da reunião/), { target: { value: 'Migrar?' } });
    fireEvent.click(chip('Ana'));
    expect(screen.getByRole('status').textContent).toMatch(/pelo menos 2/);
    fireEvent.click(chip('Caio'));
    expect(submit().disabled).toBe(false);
  });

  it('defaults the moderator to the primary bot and submits ids', () => {
    const onStart = setup();
    fireEvent.change(screen.getByLabelText(/Pergunta da reunião/), { target: { value: ' Migrar? ' } });
    fireEvent.click(chip('Ana'));
    fireEvent.click(chip('Caio'));
    expect((screen.getByLabelText(/Moderador/) as HTMLSelectElement).value).toBe('b2');
    fireEvent.click(submit());
    expect(onStart).toHaveBeenCalledWith({ question: 'Migrar?', participantIds: ['a1', 'c3'], moderatorId: 'b2' });
  });

  it('blocks external-agent bots and caps at 6', () => {
    const many = [...bots.slice(0, 3), ...['d4', 'e5', 'f6', 'h8', 'i9'].map((id) => bot(id, `Bot${id}`))];
    setup({ bots: many });
    for (const id of ['Ana', 'Beto', 'Caio', 'Botd4', 'Bote5', 'Botf6']) fireEvent.click(chip(id));
    expect((chip('Both8') as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    setup();
    expect((chip('Grok') as HTMLButtonElement).disabled).toBe(true);
    expect(chip('Grok').getAttribute('title')).toMatch(/externo/);
  });

  it('is disabled with a reason for non-admins', () => {
    setup({ canEdit: false });
    expect(submit().disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Só o admin abre reuniões');
    expect((chip('Ana') as HTMLButtonElement).disabled).toBe(true);
  });
});
