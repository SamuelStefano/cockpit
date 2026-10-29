export type PanelTone = 'green' | 'yellow' | 'red' | 'orange' | 'neutral' | 'purple';

export interface PanelItem {
  title: string;
  detail?: string;
  link?: string;
  tag?: string;
}

export interface PanelColumn {
  label: string;
  tone: PanelTone;
  items: PanelItem[];
}

export interface DeckPanelData {
  title: string;
  subtitle?: string;
  columns: PanelColumn[];
}

const TONES: PanelTone[] = ['green', 'yellow', 'red', 'orange', 'neutral', 'purple'];

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

// Only http(s) links: the payload is model output, so a javascript: URL must never reach href.
const safeLink = (v: unknown): string | undefined => {
  const s = str(v);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
};

function parseItem(raw: unknown): PanelItem | null {
  if (typeof raw === 'string') return str(raw) ? { title: raw } : null;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const title = str(o.title);
  if (!title) return null;
  return { title, detail: str(o.detail), link: safeLink(o.link), tag: str(o.tag) };
}

function parseColumn(raw: unknown): PanelColumn | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = str(o.label);
  if (!label || !Array.isArray(o.items)) return null;
  const tone = TONES.includes(o.tone as PanelTone) ? (o.tone as PanelTone) : 'neutral';
  const items = o.items.map(parseItem).filter((i): i is PanelItem => i !== null);
  return { label, tone, items };
}

// Returns null for anything that is not a complete, valid panel — including JSON still
// streaming in — so the caller falls back to a plain code block.
export function parsePanel(code: string): DeckPanelData | null {
  let raw: unknown;
  try { raw = JSON.parse(code); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.columns)) return null;
  const columns = o.columns.map(parseColumn).filter((c): c is PanelColumn => c !== null);
  if (!columns.length) return null;
  return { title: str(o.title) ?? 'Painel', subtitle: str(o.subtitle), columns };
}
