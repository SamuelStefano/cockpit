import { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icon';
import { subscribeToast, type ToastItem } from './toast-bus';

const MAX_VISIBLE = 3;

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { id, durationMs } = item;
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), durationMs);
    return () => clearTimeout(t);
  }, [id, durationMs, onDismiss]);

  return (
    <div className="fade-up pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 shadow-lg shadow-black/40">
      {item.tone === 'error' && <Icon name="x" size={14} className="shrink-0 text-red-400" />}
      <span className={`min-w-0 flex-1 text-[13px] leading-snug ${item.tone === 'error' ? 'text-red-200' : 'text-neutral-100'}`}>
        {item.message}
      </span>
      {item.action && (
        <button
          onClick={() => { item.action!.onClick(); onDismiss(id); }}
          className="shrink-0 text-[12px] font-medium text-orange-400 hover:text-orange-300"
        >
          {item.action.label}
        </button>
      )}
      <button onClick={() => onDismiss(id)} aria-label="Fechar" className="shrink-0 text-neutral-600 hover:text-neutral-300">
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToast((item) => {
    setItems((prev) => [...prev, item].slice(-MAX_VISIBLE));
  }), []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (!items.length) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      {items.map((t) => <ToastCard key={t.id} item={t} onDismiss={dismiss} />)}
    </div>
  );
}
