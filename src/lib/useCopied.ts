import { useCallback, useEffect, useRef, useState } from 'react';

// Copia pro clipboard e expõe um flag `copied` que volta a false após resetMs —
// o padrão de feedback "✓ copiado" repetido em vários botões. Limpa o timer no
// unmount pra não dar setState num componente já desmontado.
export function useCopied(resetMs = 1500): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
    }).catch(() => {});
  }, [resetMs]);

  return [copied, copy];
}
