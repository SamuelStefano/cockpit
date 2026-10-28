import { useMemo, useRef, useState } from 'react';
import type { Connection } from '../../../shared/connections';
import type { ModelInfo } from '../../../shared/protocol';
import { CAP_LABEL, PROVIDERS, type Cap, type ProviderId } from '../../../shared/model-catalog';
import { Icon, tokens, type IconName } from '../primitives';
import { usePersisted } from '../../lib/persist';
import { normalizeModelId } from './toolbar-format';
import { buildGroups, pushRecent, toggleFav, type PickItem } from './model-list';

const CAP_ICON: Record<Cap, IconName> = { vision: 'eye', tools: 'wrench', longctx: 'book', web: 'globe', local: 'cpu' };
const FAVS_KEY = 'modelFavs';
const RECENTS_KEY = 'modelRecents';

export interface NoneOption { title: string; sub: string }

export interface ModelPanelProps {
  options: ModelInfo[];
  current: string;
  connections: Connection[];
  onPick: (id: string) => void;
  onAdd: () => void;
  onExpired: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onManage?: () => void;
  fallbackFor?: ProviderId;
  none?: NoneOption;
  trackRecent?: boolean;
  allowCustomId?: boolean;
}

function Logo({ id }: { id: ProviderId }) {
  const p = PROVIDERS[id];
  return <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] text-[9px] font-semibold" style={{ background: p.bg, color: p.fg }}>{p.logo}</span>;
}

function Caps({ item }: { item: PickItem }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-neutral-500">
      {item.caps.map((c) => (
        <span key={c} role="img" aria-label={CAP_LABEL[c]} title={CAP_LABEL[c]} className="inline-flex"><Icon name={CAP_ICON[c]} size={13} /></span>
      ))}
    </span>
  );
}

function Row({ item, current, fav, showProvider, onPick, onFav }: {
  item: PickItem; current: boolean; fav: boolean; showProvider: boolean; onPick: () => void; onFav: () => void;
}) {
  const sub = item.expired ? 'entre de novo em Conexões' : showProvider ? [item.providerName, item.sameQuota ? '' : item.nick].filter(Boolean).join(' · ') : item.nick;
  return (
    <div className={`group flex min-h-[38px] items-center gap-2 rounded-lg px-2 hover:bg-neutral-800/60 pointer-coarse:min-h-11 ${current ? 'bg-neutral-800/50' : ''} ${item.expired ? 'opacity-60' : ''}`}>
      <button type="button" onClick={onPick} aria-current={current || undefined} aria-label={item.expired ? `${item.short} — expirou, entre de novo em Conexões` : item.short}
        className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left ${tokens.focusRing} rounded-md`}>
        {showProvider && <Logo id={item.providerId} />}
        <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-100">
          {item.short}
          {sub && <small className="ml-1.5 text-[12px] text-neutral-500">{sub}</small>}
        </span>
        {!item.expired && <Caps item={item} />}
        {item.expired && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">expirou</span>}
        {item.sameQuota && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">mesma cota</span>}
        {item.free && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">grátis</span>}
      </button>
      {!item.expired && !item.ghost && (
        <button type="button" onClick={onFav} aria-label={fav ? `Tirar ${item.short} dos favoritos` : `Favoritar ${item.short}`} aria-pressed={fav}
          className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md ${fav ? 'text-orange-400' : 'text-neutral-600 hover:text-neutral-300'} ${tokens.focusRing}`}>
          <Icon name="star" size={13} className={fav ? 'fill-current' : ''} />
        </button>
      )}
      {current && <Icon name="check" size={14} className="shrink-0 text-orange-400" />}
    </div>
  );
}

export function ModelPanel(p: ModelPanelProps) {
  const [query, setQuery] = useState('');
  const [favs, setFavs] = usePersisted<string[]>(FAVS_KEY, []);
  const [recents, setRecents] = usePersisted<string[]>(RECENTS_KEY, []);
  const searchRef = useRef<HTMLInputElement>(null);
  const groups = useMemo(
    () => buildGroups({ options: p.options, connections: p.connections, favs, recents, query, fallbackFor: p.fallbackFor }),
    [p.options, p.connections, favs, recents, query, p.fallbackFor],
  );
  const customId = p.allowCustomId ? normalizeModelId(query) : null;
  const known = customId ? p.options.some((o) => o.id === customId) : true;

  const pick = (item: PickItem) => {
    if (item.expired) { p.onExpired(); return; }
    if (item.ghost) return;
    if (p.trackRecent !== false) setRecents(pushRecent(recents, item.id));
    p.onPick(item.id);
  };
  const firstEnabled = groups.flatMap((g) => g.items).find((i) => !i.expired && !i.ghost);

  return (
    <div className="flex w-full flex-col sm:w-[380px]">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2.5">
        <Icon name="search" size={14} className="shrink-0 text-neutral-500" />
        <input
          ref={searchRef}
          autoFocus
          aria-label="Buscar modelo"
          placeholder="Buscar modelo… (ex.: rápido, local, visão)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.key !== 'Enter') return;
            e.preventDefault();
            if (customId && !known) { p.onPick(customId); return; }
            if (firstEnabled) pick(firstEnabled);
          }}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-neutral-100 placeholder-neutral-600 outline-hidden"
        />
        {p.onRefresh && (
          <button type="button" onClick={p.onRefresh} disabled={p.refreshing}
            title="Buscar modelos novos da Anthropic agora"
            aria-label={p.refreshing ? 'Buscando modelos…' : 'Buscar modelos novos da Anthropic agora'}
            className={`flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 ${tokens.focusRing}`}>
            <Icon name="rotate" size={12} className={p.refreshing ? 'spin text-orange-400' : ''} />
          </button>
        )}
      </div>
      <div className="scroll-thin max-h-[min(420px,60dvh)] overflow-y-auto p-1.5" role="listbox" aria-label="Modelos">
        {p.none && !query && (
          <button type="button" onClick={() => p.onPick('')} aria-current={p.current === '' || undefined}
            className={`mb-1 flex min-h-[38px] w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-neutral-800/60 ${tokens.focusRing}`}>
            <span className="min-w-0 flex-1 text-[13px] text-neutral-100">{p.none.title}<small className="ml-1.5 text-[12px] text-neutral-500">{p.none.sub}</small></span>
            {p.current === '' && <Icon name="check" size={14} className="text-orange-400" />}
          </button>
        )}
        {customId && !known && (
          <button type="button" onClick={() => p.onPick(customId)} className={`mb-1 flex min-h-[38px] w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-neutral-200 hover:bg-neutral-800/60 ${tokens.focusRing}`}>
            <Icon name="plus" size={13} className="text-neutral-500" /> Usar <span className="font-mono text-[12px]">{customId}</span>
          </button>
        )}
        {groups.map((g) => (
          <div key={g.key} className="mb-1">
            <div className="flex items-center gap-2 px-2 pb-1 pt-2 text-[12px] font-medium text-neutral-400">
              {g.providerId && <Logo id={g.providerId} />}
              <span>{g.title}</span>
              {g.faint && <span className="font-normal text-neutral-500">· {g.faint}</span>}
            </div>
            {g.items.map((i) => (
              <Row key={`${g.key}:${i.id}`} item={i} current={i.id === p.current} fav={favs.includes(i.id)} showProvider={g.key === 'fav' || g.key === 'suggested' || g.key === 'all'}
                onPick={() => pick(i)} onFav={() => setFavs(toggleFav(favs, i.id))} />
            ))}
          </div>
        ))}
        {!groups.length && !(customId && !known) && <p className="px-3 py-6 text-center text-[13px] text-neutral-500">Nenhum modelo com “{query}”.</p>}
      </div>
      <div className="flex items-center gap-1 border-t border-neutral-800 p-1.5">
        <button type="button" onClick={p.onAdd} className={`flex min-h-[38px] flex-1 items-center gap-2 rounded-lg px-2 text-left text-[13px] text-neutral-200 hover:bg-neutral-800/60 ${tokens.focusRing}`}>
          <Icon name="plus" size={14} className="text-neutral-500" />
          <span className="flex-1">Adicionar modelo ou provedor</span>
          <span className="text-[12px] text-neutral-500">Conexões</span>
          <Icon name="chevronRight" size={12} className="text-neutral-600" />
        </button>
        {p.onManage && (
          <button type="button" onClick={p.onManage} className={`min-h-[38px] rounded-lg px-2 text-[12px] text-neutral-500 hover:text-neutral-200 ${tokens.focusRing}`}>Gerenciar</button>
        )}
      </div>
    </div>
  );
}
