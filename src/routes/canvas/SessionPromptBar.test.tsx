// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { SessionPromptBar } from './SessionPromptBar';

afterEach(cleanup);

const PLACEHOLDER = 'mandar prompt pra esta sessão…';

describe('SessionPromptBar', () => {
  it('renders the input, ready to receive a prompt for this session', () => {
    render(<SessionPromptBar onSend={vi.fn(() => true)} />);
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();
  });

  it('Enter sends the trimmed text and clears the field ONLY when onSend reports success', () => {
    const onSend = vi.fn(() => true);
    render(<SessionPromptBar onSend={onSend} />);
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  oi  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('oi');
    expect(input.value).toBe('');
  });

  it('keeps the text when onSend reports failure (ws closed — caller already toasted)', () => {
    const onSend = vi.fn(() => false);
    render(<SessionPromptBar onSend={onSend} />);
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'oi' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('oi');
    expect(input.value).toBe('oi');
  });

  it('an Enter that is finalizing IME composition does not send', () => {
    const onSend = vi.fn(() => true);
    render(<SessionPromptBar onSend={onSend} />);
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: '変換中' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('the send button does the same as Enter', () => {
    const onSend = vi.fn(() => true);
    render(<SessionPromptBar onSend={onSend} />);
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: 'oi' } });
    fireEvent.click(screen.getByTitle('enviar'));
    expect(onSend).toHaveBeenCalledWith('oi');
  });

  it('an empty (or all-whitespace) prompt is never sent', () => {
    const onSend = vi.fn(() => true);
    render(<SessionPromptBar onSend={onSend} />);
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disabled: shows a hint placeholder, and neither Enter nor the button send anything', () => {
    const onSend = vi.fn(() => true);
    render(<SessionPromptBar onSend={onSend} disabled disabledHint="sessão em terminal interativo" />);
    expect(screen.getByPlaceholderText('sessão em terminal interativo')).toBeTruthy();
    const input = screen.getByPlaceholderText('sessão em terminal interativo') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByTitle('sessão em terminal interativo'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('a later server rejection (restoreText) puts the text back and acks via onRestored', () => {
    const onRestored = vi.fn();
    const { rerender } = render(<SessionPromptBar onSend={vi.fn(() => true)} restoreText={null} onRestored={onRestored} />);
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    expect(input.value).toBe('');
    rerender(<SessionPromptBar onSend={vi.fn(() => true)} restoreText="prompt rejeitado" onRestored={onRestored} />);
    expect(input.value).toBe('prompt rejeitado');
    expect(onRestored).toHaveBeenCalled();
  });

  it('a click on the row itself does not bubble a pointerdown out (no window drag)', () => {
    // Real usage nests this under the window's own onPointerDown drag handler
    // (TerminalWindow.tsx); wiring the outer listener as a React prop (not a
    // raw addEventListener on the RTL mount node) matches that synthetic tree.
    const onOuter = vi.fn();
    render(<div onPointerDown={onOuter}><SessionPromptBar onSend={vi.fn(() => true)} /></div>);
    fireEvent.pointerDown(screen.getByPlaceholderText(PLACEHOLDER).closest('div')!);
    expect(onOuter).not.toHaveBeenCalled();
  });
});
