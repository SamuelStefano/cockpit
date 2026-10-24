import { useCallback, useRef } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import { toast } from './primitives';

export interface TerminalClipboardApi {
  copy: () => Promise<void>;
  paste: () => Promise<void>;
}

export type ClipboardKeyAction = 'copy' | 'paste' | null;

interface KeyLike {
  type: string;
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

// Plain Ctrl+C only copies while text is selected, otherwise it stays ^C (SIGINT).
// Ctrl+V and Ctrl+Shift+V both paste through the clipboard API; the handler cancels
// the keydown so the browser's native paste does not fire a second time. Cmd+V is
// left to the native paste event for the same reason. ^V (quoted-insert) is given up.
export function clipboardKeyAction(e: KeyLike, hasSelection: boolean): ClipboardKeyAction {
  if (e.type !== 'keydown' || e.altKey) return null;
  const key = e.key.toLowerCase();
  if (key === 'c') {
    if (e.ctrlKey && e.shiftKey && !e.metaKey) return 'copy';
    if (e.metaKey && !e.ctrlKey && !e.shiftKey) return 'copy';
    if (e.ctrlKey && !e.shiftKey && !e.metaKey && hasSelection) return 'copy';
  }
  if (key === 'v' && e.ctrlKey && !e.metaKey) return 'paste';
  return null;
}

const NOTE_MS = 1800;

export function useTerminalClipboard() {
  const xtRef = useRef<XTerm | null>(null);

  const copy = useCallback(async () => {
    const xt = xtRef.current;
    const text = xt?.getSelection() ?? '';
    if (!xt || !text) { toast('Nada selecionado', { durationMs: NOTE_MS }); return; }
    if (!navigator.clipboard?.writeText) { toast('Copiar exige HTTPS ou localhost', { tone: 'error' }); return; }
    try {
      await navigator.clipboard.writeText(text);
      xt.clearSelection();
      toast('Copiado', { durationMs: NOTE_MS });
    } catch {
      toast('O navegador bloqueou o acesso à área de transferência', { tone: 'error' });
    }
  }, []);

  const paste = useCallback(async () => {
    const xt = xtRef.current;
    if (!xt) return;
    if (!navigator.clipboard?.readText) { toast('Colar exige HTTPS ou localhost', { tone: 'error' }); return; }
    try {
      const text = await navigator.clipboard.readText();
      if (text) xt.paste(text);
      else toast('Área de transferência vazia', { durationMs: NOTE_MS });
    } catch {
      toast('O navegador bloqueou o acesso à área de transferência', { tone: 'error' });
    }
  }, []);

  // Returns the cleanup. Called from XtermView's mount effect, where xt is created.
  const bind = useCallback((xt: XTerm, el: HTMLElement) => {
    xtRef.current = xt;
    xt.attachCustomKeyEventHandler((e) => {
      const action = clipboardKeyAction(e, xt.hasSelection());
      if (!action) return true;
      e.preventDefault();
      if (action === 'copy') void copy(); else void paste();
      return false;
    });
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (xt.hasSelection()) void copy(); else void paste();
    };
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('contextmenu', onContextMenu);
      if (xtRef.current === xt) xtRef.current = null;
    };
  }, [copy, paste]);

  return { bind, copy, paste };
}
