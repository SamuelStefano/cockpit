import { createContext, useContext } from 'react';
import { resolveSessionRef } from './session-link';

// Injected by the app shell. `null` (no provider) keeps session ids as plain text.
export interface SessionLinkResolver {
  ids: readonly string[];
  open: (id: string) => void;
}

export const SessionLinkContext = createContext<SessionLinkResolver | null>(null);

export function useSessionRef(ref: string | undefined): { id: string; open: () => void } | null {
  const ctx = useContext(SessionLinkContext);
  if (!ctx || !ref) return null;
  const id = resolveSessionRef(ref, ctx.ids);
  return id ? { id, open: () => ctx.open(id) } : null;
}

export function SessionLink({ value }: { value: string }) {
  const hit = useSessionRef(value);
  if (!hit) return <>{value}</>;
  return (
    <button
      type="button"
      onClick={hit.open}
      title="Open session"
      className="cursor-pointer rounded-sm font-mono text-[0.9em] text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:decoration-orange-400"
    >
      {value}
    </button>
  );
}
