// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChatInput } from './useChatInput';

const HISTORY = ['primeira', 'segunda'];

function setup(initialValue: string, history = HISTORY) {
  const setValue = vi.fn();
  const ta = document.createElement('textarea');
  document.body.appendChild(ta);
  ta.value = initialValue;
  const hook = renderHook(
    ({ value }: { value: string }) =>
      useChatInput({
        disabled: false,
        onSend: vi.fn(),
        onStop: vi.fn(),
        value,
        setValue,
        setMode: vi.fn(),
        setModel: vi.fn(),
        slashCommands: [],
        hasAtt: false,
        onUpload: vi.fn(),
        focusSignal: 0,
        onQueue: vi.fn(),
        history,
        onNew: vi.fn(),
      }),
    { initialProps: { value: initialValue } },
  );
  // The hook reads the caret off the real textarea, not off React state.
  hook.result.current.taRef.current = ta;
  const setText = (v: string) => { ta.value = v; hook.rerender({ value: v }); };
  return { ...hook, setValue, ta, setText };
}

function keyEvent(key: string) {
  const prevented = { value: false };
  const e = {
    key,
    shiftKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: () => { prevented.value = true; },
  } as unknown as React.KeyboardEvent;
  return { e, prevented };
}

function changeEvent(target: HTMLTextAreaElement, next: string) {
  target.value = next;
  return { target } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
}

beforeEach(() => localStorage.clear());

describe('useChatInput — history recall', () => {
  it('ArrowUp on an empty composer recalls the previous message', () => {
    const { result, setValue } = setup('');
    act(() => result.current.onKey(keyEvent('ArrowUp').e));
    expect(setValue).toHaveBeenLastCalledWith('segunda');
  });

  it('ArrowDown walks back down the history', () => {
    const { result, setValue, setText } = setup('');
    act(() => result.current.onKey(keyEvent('ArrowUp').e));
    setText('segunda');
    act(() => result.current.onKey(keyEvent('ArrowUp').e));
    expect(setValue).toHaveBeenLastCalledWith('primeira');
    setText('primeira');
    act(() => result.current.onKey(keyEvent('ArrowDown').e));
    expect(setValue).toHaveBeenLastCalledWith('segunda');
  });

  it('ArrowUp inside a multi-line recalled message moves the cursor, it does not swap the message', () => {
    const multi = 'linha um\nlinha dois';
    const { result, setValue, setText, ta } = setup('', [...HISTORY, multi]);
    act(() => result.current.onKey(keyEvent('ArrowUp').e)); // recall is now on the multi-line entry
    expect(setValue).toHaveBeenLastCalledWith(multi);
    setText(multi);
    setValue.mockClear();
    ta.setSelectionRange(multi.length, multi.length); // caret on the last line
    const { e, prevented } = keyEvent('ArrowUp');
    act(() => result.current.onKey(e));
    expect(setValue).not.toHaveBeenCalled();
    expect(prevented.value).toBe(false); // the browser moves the caret up one line
  });

  it('ArrowUp from the first line of a multi-line message still walks the history', () => {
    const multi = 'linha um\nlinha dois';
    const { result, setValue, setText, ta } = setup('', [...HISTORY, multi]);
    act(() => result.current.onKey(keyEvent('ArrowUp').e));
    setText(multi);
    setValue.mockClear();
    ta.setSelectionRange(2, 2); // caret on the first line
    act(() => result.current.onKey(keyEvent('ArrowUp').e));
    expect(setValue).toHaveBeenLastCalledWith('segunda');
  });
});

describe('useChatInput — arrow keys delivered as raw text', () => {
  it('never lets the ANSI sequence land in the composer as text', () => {
    const { result, setValue, ta } = setup('');
    act(() => result.current.grow(changeEvent(ta, '[A')));
    expect(setValue).toHaveBeenCalled();
    for (const call of setValue.mock.calls) expect(call[0]).not.toMatch(/|\^\[/);
  });

  it('a typed ^[[A recalls the previous message instead of being inserted', () => {
    const { result, setValue, ta } = setup('');
    act(() => result.current.grow(changeEvent(ta, '^[[A')));
    expect(setValue).toHaveBeenLastCalledWith('segunda');
  });

  it('a typed ^[[B after a recall walks back down', () => {
    const { result, setValue, ta } = setup('');
    act(() => result.current.grow(changeEvent(ta, '^[[A')));
    act(() => result.current.grow(changeEvent(ta, '^[[B')));
    expect(setValue).toHaveBeenLastCalledWith('');
  });

  it('strips a sequence typed in the middle of real text without recalling', () => {
    const { result, setValue, ta } = setup('ola');
    act(() => result.current.grow(changeEvent(ta, 'ola[C mundo')));
    expect(setValue).toHaveBeenLastCalledWith('ola mundo');
  });
});

describe('useChatInput — send while dictating', () => {
  it('stops the recognizer before clearing the composer', () => {
    const recs: { stop: () => void; stopped: boolean; start: () => void; onresult: unknown }[] = [];
    class FakeRec {
      stopped = false; onresult: unknown = null; onend = null; onerror = null;
      constructor() { recs.push(this); }
      start() {}
      stop() { this.stopped = true; }
    }
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRec;
    try {
      const { result, setText } = setup('');
      act(() => result.current.mic.start());
      setText('ship it');
      act(() => result.current.submit());
      expect(result.current.mic.listening).toBe(false);
      expect(recs[0].stopped).toBe(true);
      expect(recs[0].onresult).toBeNull();
    } finally {
      delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    }
  });
});
