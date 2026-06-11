import { useCallback, useEffect, useRef, useState } from 'react';

// Copia pro clipboard e expõe um flag `copied` que volta a false após resetMs —
// o padrão de feedback "✓ copiado" repetido em vários botões. Limpa o timer no
// unmount pra não dar setState num componente já desmontado.
// navigator.clipboard só existe em contexto seguro (HTTPS/localhost). Acessando o
// app por IP/http o copiar falhava mudo; execCommand é deprecated mas é o único
// caminho nesses contextos.
function legacyCopy(text: string): boolean {
  const prev = document.activeElement;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  if (prev instanceof HTMLElement) prev.focus();
  return ok;
}

export function useCopied(resetMs = 1500): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback((text: string) => {
    const done = () => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done).catch(() => { if (legacyCopy(text)) done(); });
    } else if (legacyCopy(text)) {
      done();
    }
  }, [resetMs]);

  return [copied, copy];
}
