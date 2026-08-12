export type ToastTone = 'ok' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  tone?: ToastTone;
  action?: ToastAction;
  durationMs?: number;
}

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
  durationMs: number;
}

export const TOAST_DEFAULT_MS = 5000;

type Listener = (item: ToastItem) => void;

const listeners = new Set<Listener>();
let seq = 0;

export function toast(message: string, opts: ToastOptions = {}): number {
  const item: ToastItem = {
    id: ++seq,
    message,
    tone: opts.tone ?? 'ok',
    action: opts.action,
    durationMs: opts.durationMs ?? TOAST_DEFAULT_MS,
  };
  for (const l of listeners) l(item);
  return item.id;
}

export function subscribeToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
