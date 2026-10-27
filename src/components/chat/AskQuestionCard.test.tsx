// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { AssistantBlocks } from './AssistantBlocks';
import { BotThreadContext } from './bot-thread-context';

afterEach(cleanup);

const tool = (multiSelect = false) => ({
  id: 't1', name: 'AskUserQuestion', label: '', command: '', status: 'done', output: [],
  questions: [{ question: 'O que faço com a proposta do cadastro do dia 2?', header: 'Cadastro', multiSelect, options: [
    { label: 'Aprovar com os ajustes (Recomendada)' }, { label: 'Aprovar como está' }, { label: 'Pedir um novo mockup antes' }, { label: 'Cortar' },
  ] }],
});
const blocks = (multi = false) => [{ type: 'tool', tool: tool(multi) }] as never;

const mount = (onAnswer = vi.fn(() => true), opts: { bot?: boolean; answerable?: boolean; multi?: boolean } = {}) => render(
  <BotThreadContext.Provider value={opts.bot ?? true}>
    <AssistantBlocks blocks={blocks(opts.multi)} caretOnLast={false} answerable={opts.answerable ?? true} onAnswer={onAnswer} />
    <textarea aria-label="composer" />
  </BotThreadContext.Provider>,
);

describe('AskQuestionCard', () => {
  it('shows the question in bold with lettered options A–D', () => {
    const r = mount();
    expect(r.getByText('O que faço com a proposta do cadastro do dia 2?').className).toContain('font-semibold');
    expect(['A', 'B', 'C', 'D'].map((l) => r.getByText(l).textContent)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('a click sends the option as the next human message, once', () => {
    const onAnswer = vi.fn(() => true);
    const r = mount(onAnswer);
    fireEvent.click(r.getByText('Aprovar como está'));
    fireEvent.click(r.getByText('Cortar'));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith('Aprovar como está');
  });

  it('a bare letter answers only with focus outside the composer, never while typing', () => {
    const onAnswer = vi.fn(() => true);
    const r = mount(onAnswer);
    const ta = r.getByLabelText('composer') as HTMLTextAreaElement;
    ta.value = 'acho que';
    fireEvent.keyDown(ta, { key: 'c' });
    ta.value = '';
    fireEvent.keyDown(ta, { key: 'a' });
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'c' });
    expect(onAnswer).toHaveBeenCalledWith('Pedir um novo mockup antes');
  });

  it('stays answerable when the answer did not leave (offline)', () => {
    const onAnswer = vi.fn(() => false);
    const r = mount(onAnswer);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'd' });
    expect(onAnswer.mock.calls).toEqual([['Aprovar com os ajustes'], ['Cortar']]);
    expect((r.getByText('Cortar').closest('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('marks the recommended option and says so in the footer, without the marker in the answer', () => {
    const onAnswer = vi.fn(() => true);
    const r = mount(onAnswer);
    expect(r.getByText('Recomendo A. Responda com a letra ou escreva outra ideia.')).toBeTruthy();
    expect((r.getByText('Aprovar com os ajustes').closest('button') as HTMLButtonElement).className).toContain('border-orange-500/40');
    fireEvent.click(r.getByText('Aprovar com os ajustes'));
    expect(onAnswer).toHaveBeenCalledWith('Aprovar com os ajustes');
  });

  it('history is read-only; outside a team thread letters render but the key shortcut stays off', () => {
    const onAnswer = vi.fn(() => true);
    const ro = mount(onAnswer, { answerable: false });
    fireEvent.keyDown(window, { key: 'a' });
    expect(onAnswer).not.toHaveBeenCalled();
    expect((ro.getByText('Cortar').closest('button') as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const plain = mount(onAnswer, { bot: false });
    expect(plain.getByText('A')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'a' });
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(plain.getByText('Cortar'));
    expect(onAnswer).toHaveBeenCalledWith('Cortar');
    cleanup();
    expect(mount(onAnswer, { multi: true }).getByText('Enviar resposta')).toBeTruthy();
  });
});
