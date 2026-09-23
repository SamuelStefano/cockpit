import { forwardRef, useEffect, useState } from 'react';
import { Button, Input } from '../../components/primitives';

interface Props {
  onSend: (text: string) => boolean; // false = not dispatched (ws closed) — text is kept, caller already toasted
  disabled?: boolean; // the pane is a resumed interactive claude — sending here would start a SECOND writer
  disabledHint?: string;
  restoreText?: string | null; // a LATER server rejection wants this back in the field (see useCockpit.canvasSendError)
  onRestored?: () => void; // ack the restore so the parent clears its pending state
}

const DISABLED_HINT_DEFAULT = 'sessão retomada num terminal interativo — feche-o antes de mandar prompt por aqui';

// One-line composer pinned to the bottom of a session window. stopPropagation
// on pointerdown keeps a click/drag here from dragging the window (the header
// is the only drag handle); Enter sends (isComposing guards an IME
// composition's finalizing Enter from being read as "send"), Shift+Enter is
// left to the browser's default (single-line input has no newline to insert).
export const SessionPromptBar = forwardRef<HTMLInputElement, Props>(function SessionPromptBar({ onSend, disabled, disabledHint, restoreText, onRestored }, ref) {
  const [value, setValue] = useState('');

  // A send this bar fired earlier got rejected server-side (prompt too large,
  // fila cheia) well after the optimistic clear — restore it instead of the
  // text just vanishing.
  useEffect(() => {
    if (restoreText == null) return;
    setValue(restoreText);
    onRestored?.();
  }, [restoreText, onRestored]);

  const submit = () => {
    if (disabled) return;
    const text = value.trim();
    if (!text) return;
    if (onSend(text)) setValue(''); // clear only once actually dispatched
  };

  return (
    // Fixed 28px (h-7) row, same height as the square send button — never
    // varies, so it never resizes the terminal body above it either.
    <div onPointerDown={(e) => e.stopPropagation()} className="flex h-7 shrink-0 items-center gap-1 overflow-hidden border-t border-neutral-800 bg-neutral-950 px-1.5">
      <Input
        ref={ref} size="sm" disabled={disabled} value={value}
        placeholder={disabled ? (disabledHint ?? DISABLED_HINT_DEFAULT) : 'mandar prompt pra esta sessão…'}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
      />
      <Button variant="ghost" size="sm" square icon="send" disabled={disabled} title={disabled ? (disabledHint ?? DISABLED_HINT_DEFAULT) : 'enviar'} onClick={submit} />
    </div>
  );
});
