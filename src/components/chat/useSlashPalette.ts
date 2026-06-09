import { useState, useEffect, useMemo } from 'react';

export function useSlashPalette(disabled: boolean, value: string, slashCommands: string[]) {
  const [sel, setSel] = useState(0);
  // "/" sozinho lista tudo; espaços continuam filtrando (comandos multi-palavra
  // como "model opus"/"effort low"). Newline = mensagem de verdade, não comando.
  const slashOpen = !disabled && value.startsWith('/') && !value.includes('\n');
  const slashQuery = slashOpen ? value.slice(1).toLowerCase() : '';
  const matches = useMemo(
    () => (slashOpen ? slashCommands.filter((c) => c.toLowerCase().includes(slashQuery)).slice(0, 8) : []),
    [slashOpen, slashQuery, slashCommands],
  );
  const [dismissed, setDismissed] = useState(false);
  const showPalette = matches.length > 0 && !dismissed;
  // Esc dispensa a palette mas preserva o texto; digitar de novo a traz de volta.
  useEffect(() => { setSel(0); setDismissed(false); }, [slashQuery, slashOpen]);
  return { sel, setSel, matches, showPalette, setDismissed };
}
