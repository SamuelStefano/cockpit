import { createContext, useContext, type ReactNode } from 'react';
import { looksLikePath } from '../../chat/file-panel/looks-like-path';

// Injected by the chat shell. `null` (no provider) keeps paths as plain text.
export interface FilePathOpener { open: (path: string) => void }

export const FilePathContext = createContext<FilePathOpener | null>(null);

export function FilePathLink({ path, children, className = '' }: { path: string; children?: ReactNode; className?: string }) {
  const ctx = useContext(FilePathContext);
  if (!ctx || !looksLikePath(path)) return <>{children ?? path}</>;
  return (
    <button
      type="button"
      onClick={() => ctx.open(path)}
      title="Abrir arquivo"
      className={`cursor-pointer rounded-sm text-left underline decoration-orange-400/40 underline-offset-2 transition hover:decoration-orange-400 ${className}`}
    >
      {children ?? path}
    </button>
  );
}
