import { createContext, useContext, type ReactNode } from 'react';
import { tokens } from '../tokens';
import { parsePathRef } from './looks-like-path';

// Injected by the chat shell. `null` (no provider) keeps paths as plain text.
export interface FilePathOpener { open: (path: string, line?: number) => void }

export const FilePathContext = createContext<FilePathOpener | null>(null);

interface FilePathLinkProps {
  path: string;
  // A tool card's path is already known to be a file: no shape check, no `:line`.
  exact?: boolean;
  children?: ReactNode;
  className?: string;
}

export function FilePathLink({ path, exact = false, children, className = '' }: FilePathLinkProps) {
  const ctx = useContext(FilePathContext);
  const ref = exact ? { path } : parsePathRef(path);
  if (!ctx || !ref) return <>{children ?? path}</>;
  return (
    <button
      type="button"
      onClick={() => ctx.open(ref.path, ref.line)}
      title="Abrir arquivo"
      className={`cursor-pointer rounded-sm text-left [font:inherit] underline decoration-orange-400/40 underline-offset-2 transition hover:decoration-orange-400 ${tokens.focusRing} ${className}`}
    >
      {children ?? path}
    </button>
  );
}
