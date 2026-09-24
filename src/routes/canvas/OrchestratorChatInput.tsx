import { useRef, useState } from 'react';
import { Button } from '../../components/primitives';
import { pushChatHistory, stepChatHistory } from './orchestrator-chat-history';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

// Multi-line composer at the bottom of the dock: Enter sends, Shift+Enter
// inserts a newline, ArrowUp/ArrowDown (only from an empty or already-browsed
// field) walk the local send history.
export function OrchestratorChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const historyIndex = useRef(0); // history.length === "live draft"
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (disabled) return;
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setHistory((h) => pushChatHistory(h, text));
    historyIndex.current = history.length + 1; // +1: pushChatHistory just grew it
    setValue('');
  };

  const recall = (direction: 1 | -1) => {
    const next = stepChatHistory(history.length, historyIndex.current, direction);
    historyIndex.current = next;
    setValue(next === history.length ? '' : history[next]);
  };

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-t border-neutral-800 bg-neutral-950 p-2">
      <textarea
        ref={ref}
        disabled={disabled}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); return; }
          // Only steal the arrow when there's nowhere else for the cursor to
          // go, so a multi-line draft's own line navigation still works.
          const el = e.currentTarget;
          if (e.key === 'ArrowUp' && el.selectionStart === 0 && el.selectionEnd === 0) { e.preventDefault(); recall(-1); }
          if (e.key === 'ArrowDown' && el.selectionStart === value.length && el.selectionEnd === value.length) { e.preventDefault(); recall(1); }
        }}
        placeholder="mandar mensagem pro orchestrator… (Enter envia, Shift+Enter quebra linha)"
        rows={3}
        className="w-full resize-none rounded-md border border-neutral-800 bg-neutral-925 px-2.5 py-2 font-mono text-[12.5px] text-neutral-200 placeholder:text-neutral-600 outline-hidden transition focus:border-fuchsia-500/40 disabled:opacity-50"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto font-mono text-[10.5px] text-neutral-600">↑/↓ histórico</span>
        <Button variant="secondary" size="sm" icon="send" disabled={disabled || !value.trim()} onClick={submit}>enviar</Button>
      </div>
    </div>
  );
}
