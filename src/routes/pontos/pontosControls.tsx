import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DflTaskNode } from '../../../shared/protocol';
import { MONTHLY_CAP_CENTS } from './month-cap';

export interface DflWriteApi {
  onDflChange: (p: { taskId: string; taskName: string; currentPoints: number; newPoints: number; reason?: string }) => Promise<{ ok: boolean; message?: string }>;
  onDflInvoice: (p: { deliveryId: string; deliveryName: string; projectId?: string | null; projectName?: string | null; referenceMonth: string; pricePerPoint: number; tasks: { id: string; title: string; points: number }[] }) => Promise<{ ok: boolean; message?: string }>;
  onPontosAgent: (p: { note: string; epicCapCents: number; monthCapCents: number; pointValue: number; target?: 'dfl' | 'drafts' }) => Promise<{ ok: boolean; message?: string }>;
}

const KEY = 'deck:pontos:excludedDeliveries';
const PV_KEY = 'deck:pontos:pointValue';
const MC_KEY = 'deck:pontos:monthCaps';
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

// Teto POR MÊS, não global: quem define quanto entra em fatura naquele mês é o
// Tainan, e o valor muda. Guardado como { '2026-09': 400000 }; mês sem override
// cai no acordo vigente (MONTHLY_CAP_CENTS).
function loadMonthCaps(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(MC_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    return out;
  } catch { return {}; }
}

export interface PontosControls {
  excluded: Set<string>;
  toggleExcluded: (id: string) => void;
  selecting: boolean;
  setSelecting: (v: boolean) => void;
  selected: Set<string>;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  // Tira da seleção só os ids informados. A fatura parcial precisa disso: limpar
  // tudo esconderia as deliveries que FALHARAM e o usuário perderia o retry.
  deselect: (ids: string[]) => void;
  pointValue: number;
  setPointValue: (v: number) => void;
  monthCapCents: (month: string) => number;
  setMonthCapCents: (month: string, cents: number) => void;
  selectedTask: DflTaskNode | null;
  setSelectedTask: (t: DflTaskNode | null) => void;
  write: DflWriteApi;
}

const Ctx = createContext<PontosControls | null>(null);

const toggle = (set: (fn: (prev: Set<string>) => Set<string>) => void) => (id: string) =>
  set((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

// Estado das preferências de /pontos: `excluded` (deliveries fora do recebível) é
// persistido; `selected`/`selecting` (multi-seleção pra somar/faturar) é efêmero.
// Fica em contexto porque o resumo (topo) e as deliveries (fundo da árvore) leem o
// mesmo estado sem prop drilling.
export function usePontosControlsState(write: DflWriteApi): PontosControls {
  const [excluded, setExcluded] = useState<Set<string>>(load);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pointValue, setPointValue] = useState<number>(loadPointValue);
  const [monthCaps, setMonthCaps] = useState<Record<string, number>>(loadMonthCaps);
  const [selectedTask, setSelectedTask] = useState<DflTaskNode | null>(null);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify([...excluded])); } catch { /* modo privado: ignora */ }
  }, [excluded]);
  useEffect(() => {
    try { localStorage.setItem(PV_KEY, String(pointValue)); } catch { /* modo privado: ignora */ }
  }, [pointValue]);
  useEffect(() => {
    try { localStorage.setItem(MC_KEY, JSON.stringify(monthCaps)); } catch { /* modo privado: ignora */ }
  }, [monthCaps]);
  return {
    excluded, toggleExcluded: toggle(setExcluded),
    selecting, setSelecting,
    selected, toggleSelected: toggle(setSelected),
    clearSelected: () => setSelected(new Set()),
    deselect: (ids: string[]) => setSelected((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    }),
    pointValue, setPointValue,
    monthCapCents: (month: string) => monthCaps[month] ?? MONTHLY_CAP_CENTS,
    setMonthCapCents: (month: string, cents: number) => setMonthCaps((prev) => ({ ...prev, [month]: cents })),
    selectedTask, setSelectedTask,
    write,
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
