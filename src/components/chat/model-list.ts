import type { Connection } from '../../../shared/connections';
import {
  connectionIdFor, describeModel, matchesSearch, PROVIDER_ORDER, PROVIDERS, searchHaystack,
  type Cap, type ProviderId,
} from '../../../shared/model-catalog';

export interface PickItem {
  id: string;
  short: string;
  nick?: string;
  caps: Cap[];
  free: boolean;
  providerId: ProviderId;
  providerName: string;
  expired: boolean;
  ghost: boolean;
  sameQuota: boolean;
  haystack: string;
}

export interface PickGroup {
  key: string;
  title: string;
  faint?: string;
  providerId?: ProviderId;
  items: PickItem[];
}

export interface BuildInput {
  options: { id: string; displayName?: string }[];
  connections: Connection[];
  favs: readonly string[];
  recents: readonly string[];
  query: string;
  fallbackFor?: ProviderId;
}

const RECENT_MAX = 3;

function itemOf(o: { id: string; displayName?: string }, byId: Map<string, Connection>, ghost = false): PickItem {
  const meta = describeModel(o.id, o.displayName);
  const conn = byId.get(connectionIdFor(meta.providerId, o.id));
  const name = PROVIDERS[meta.providerId].name;
  return {
    id: o.id, short: meta.short, nick: meta.nick, caps: meta.caps, free: meta.free, providerId: meta.providerId,
    providerName: name, expired: conn?.state === 'expired', ghost, sameQuota: false, haystack: searchHaystack(meta, name),
  };
}

export function buildGroups(inp: BuildInput): PickGroup[] {
  const byId = new Map(inp.connections.map((c) => [c.id, c]));
  const items = inp.options.map((o) => itemOf(o, byId));
  const have = new Set(items.map((i) => connectionIdFor(i.providerId, i.id)));
  for (const c of inp.connections) {
    if (c.kind !== 'provider' || c.state !== 'expired' || !c.id.startsWith('provider:')) continue;
    const key = c.id.slice('provider:'.length);
    if (have.has(c.id)) continue;
    const ghost = itemOf({ id: key === 'claude' ? 'claude' : `agent:${key}`, displayName: c.label }, byId, true);
    items.push({ ...ghost, short: c.label });
  }
  const q = inp.query.trim();
  const shown = q ? items.filter((i) => matchesSearch(i.haystack, q)) : items;

  if (inp.fallbackFor) {
    const other = shown.filter((i) => i.providerId !== inp.fallbackFor && !i.expired);
    const rest = shown.filter((i) => !other.includes(i)).map((i) => ({ ...i, sameQuota: i.providerId === inp.fallbackFor }));
    const out: PickGroup[] = [];
    if (other.length) out.push({ key: 'suggested', title: 'Sugeridas como reserva', faint: 'outro provedor, mais barato', items: other });
    if (rest.length) out.push({ key: 'all', title: 'Todos os modelos', items: rest });
    return out;
  }

  const out: PickGroup[] = [];
  if (!q) {
    const pick = (ids: readonly string[]) => ids.map((id) => shown.find((i) => i.id === id && !i.ghost)).filter((i): i is PickItem => !!i);
    const fav = pick(inp.favs);
    const recent = pick(inp.recents).filter((i) => !fav.includes(i)).slice(0, RECENT_MAX);
    const merged = [...fav, ...recent];
    if (merged.length) out.push({ key: 'fav', title: 'Favoritos e recentes', items: merged });
  }
  for (const pid of PROVIDER_ORDER) {
    const list = shown.filter((i) => i.providerId === pid);
    if (!list.length) continue;
    const expired = list.every((i) => i.expired);
    const p = PROVIDERS[pid];
    out.push({ key: pid, title: p.name, faint: expired ? 'expirou' : p.pay, providerId: pid, items: list });
  }
  return out;
}

export function pushRecent(recents: readonly string[], id: string): string[] {
  return [id, ...recents.filter((r) => r !== id)].slice(0, 6);
}

export function toggleFav(favs: readonly string[], id: string): string[] {
  return favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
}
