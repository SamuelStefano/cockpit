import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY = 'deck:pontos:excludedDeliveries';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

export interface PontosControls {
  excluded: Set<string>;
  toggleExcluded: (id: string) => void;
}

const Ctx = createContext<PontosControls | null>(null);

// Estado das preferências de /pontos (deliveries fora do recebível), persistido no
// localStorage. Fica em contexto porque o resumo (topo) e as deliveries (fundo da
// árvore) leem o mesmo conjunto sem prop drilling.
export function usePontosControlsState(): PontosControls {
  const [excluded, setExcluded] = useState<Set<string>>(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify([...excluded])); } catch { /* modo privado: ignora */ }
  }, [excluded]);
  const toggleExcluded = (id: string) => setExcluded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return { excluded, toggleExcluded };
}

export function PontosControlsProvider({ value, children }: { value: PontosControls; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePontosControls(): PontosControls {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePontosControls fora do provider');
  return c;
}
