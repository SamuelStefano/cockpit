import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY = 'deck:pontos:excludedDeliveries';
const PV_KEY = 'deck:pontos:pointValue';
export const DEFAULT_POINT_VALUE = 75;

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function loadPointValue(): number {
  try {
    const n = Number(localStorage.getItem(PV_KEY));
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_POINT_VALUE;
  } catch { return DEFAULT_POINT_VALUE; }
}

export interface PontosControls {
  excluded: Set<string>;
  toggleExcluded: (id: string) => void;
  selecting: boolean;
  setSelecting: (v: boolean) => void;
  selected: Set<string>;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  pointValue: number;
  setPointValue: (v: number) => void;
}

const Ctx = createContext<PontosControls | null>(null);

const toggle = (set: (fn: (prev: Set<string>) => Set<string>) => void) => (id: string) =>
  set((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

// Estado das preferências de /pontos: `excluded` (deliveries fora do recebível) é
// persistido; `selected`/`selecting` (multi-seleção pra somar/faturar) é efêmero.
// Fica em contexto porque o resumo (topo) e as deliveries (fundo da árvore) leem o
// mesmo estado sem prop drilling.
export function usePontosControlsState(): PontosControls {
  const [excluded, setExcluded] = useState<Set<string>>(load);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pointValue, setPointValue] = useState<number>(loadPointValue);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify([...excluded])); } catch { /* modo privado: ignora */ }
  }, [excluded]);
  useEffect(() => {
    try { localStorage.setItem(PV_KEY, String(pointValue)); } catch { /* modo privado: ignora */ }
  }, [pointValue]);
  return {
    excluded, toggleExcluded: toggle(setExcluded),
    selecting, setSelecting,
    selected, toggleSelected: toggle(setSelected),
    clearSelected: () => setSelected(new Set()),
    pointValue, setPointValue,
  };
}

export function PontosControlsProvider({ value, children }: { value: PontosControls; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePontosControls(): PontosControls {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePontosControls fora do provider');
  return c;
}
