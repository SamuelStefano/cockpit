import type { CanvasCard, CanvasFlow, CanvasNode } from '../../../shared/canvas';
import { Badge, Button, Icon } from '../../components/primitives';
import { STATUS_LABEL, STATUS_TONE } from './canvas-labels';

export interface ConflictInfo { other: CanvasNode; files: string[] }

interface Props {
  nodes: CanvasNode[];
  linked: (id: string) => CanvasNode[];
  node: (id: string) => CanvasNode | undefined;
  card: (id: string) => CanvasCard | undefined;
  running: Set<string>;
  flows: CanvasFlow[];
  conflictsOf: (id: string) => ConflictInfo[];
  onPick: (id: string) => void;
  onOpenSession: (id: string) => void;
  onOpenTerm: (nodeId: string) => void;
  onNewCard: (kind: CanvasCard['kind']) => void;
  onEditCard: (id: string) => void;
  onRunCard: (card: CanvasCard) => void;
  onEditFlow: (id: string) => void;
  onChainSelected: (from: string, to: string) => void;
  onClose: () => void;
}

function FlowList({ flows, node, onEditFlow }: { flows: CanvasFlow[]; node: (id: string) => CanvasNode | undefined; onEditFlow: (id: string) => void }) {
  if (!flows.length) return null;
  return (
    <ul className="space-y-0.5">
      {flows.map((f) => (
        <li key={f.id}>
          <button
            type="button" onClick={() => onEditFlow(f.id)}
            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-neutral-800/70"
          >
            <Icon name="zap" size={11} className={`shrink-0 ${f.enabled ? 'text-orange-400' : 'text-neutral-600'}`} />
            <span className="truncate text-[11.5px] text-neutral-300">{node(f.from)?.title ?? f.from} → {node(f.to)?.title ?? f.to}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Linked({ nodes, onPick }: { nodes: CanvasNode[]; onPick: (id: string) => void }) {
  if (!nodes.length) return <p className="text-[11px] text-neutral-600">nada ligado</p>;
  return (
    <ul className="space-y-0.5">
      {nodes.slice(0, 30).map((n) => (
        <li key={n.id}>
          <button type="button" onClick={() => onPick(n.id)} className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-neutral-800/70">
            <Icon name={n.kind === 'session' ? 'terminal' : n.kind === 'card' ? 'check' : n.hub ? 'layers' : 'file'} size={11} className="shrink-0 text-neutral-500" />
            <span className="truncate text-[11.5px] text-neutral-300">{n.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Conflicts({ items, onPick }: { items: ConflictInfo[]; onPick: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide text-red-400">
        <Icon name="alertTriangle" size={11} /> Conflitos
      </div>
      <ul className="space-y-1">
        {items.map(({ other, files }) => (
          <li key={other.id}>
            <button type="button" onClick={() => onPick(other.id)} className="block w-full rounded-md px-1.5 py-1 text-left hover:bg-neutral-800/70">
              <span className="block truncate text-[11.5px] text-red-300">{other.title}</span>
              {files.map((f) => <span key={f} className="block truncate font-mono text-[10px] text-neutral-500">{f}</span>)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CanvasInspector(p: Props) {
  const one = p.nodes.length === 1 ? p.nodes[0] : null;
  const card = one?.kind === 'card' ? p.card(one.ref) : undefined;
  const incoming = one ? p.flows.filter((f) => f.to === one.id) : [];
  const outgoing = one ? p.flows.filter((f) => f.from === one.id) : [];
  const pair = p.nodes.length === 2 && p.nodes.every((n) => n.kind === 'session' || n.kind === 'card') ? p.nodes : null;
  const conflicts = one?.kind === 'session' ? p.conflictsOf(one.id) : [];
  return (
    <aside data-canvas-overlay className="absolute inset-x-3 bottom-16 top-auto z-10 flex max-h-[46vh] flex-col overflow-hidden rounded-2xl border border-neutral-700/80 bg-neutral-900/90 shadow-xl backdrop-blur-md sm:inset-x-auto sm:left-3 sm:top-3 sm:max-h-none sm:w-72">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-neutral-100">{one ? one.title : `${p.nodes.length} selecionados`}</span>
        <Button variant="ghost" size="sm" icon="x" onClick={p.onClose} title="fechar" />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2.5">
        {one && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1">
              <Badge tone={one.kind === 'card' ? 'orange' : 'neutral'}>{one.kind === 'session' ? 'sessão' : one.kind === 'card' ? 'card' : one.kind === 'shell' ? 'shell' : one.hub ? 'hub' : 'contexto'}</Badge>
              {one.kind === 'session' && p.running.has(one.ref) && <Badge tone="green" dot>rodando</Badge>}
              {one.archived && <Badge>arquivo</Badge>}
              {card && <Badge tone={STATUS_TONE[card.status]}>{STATUS_LABEL[card.status]}</Badge>}
            </div>
            <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-neutral-400">{card ? card.prompt || '—' : one.subtitle || '—'}</p>
            {one.path && <p className="break-all font-mono text-[10px] text-neutral-600">{one.path}</p>}
          </div>
        )}
        {one && <Conflicts items={conflicts} onPick={p.onPick} />}
        {one && (
          <div>
            <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">Ligações</div>
            <Linked nodes={p.linked(one.id)} onPick={p.onPick} />
          </div>
        )}
        {one && (incoming.length > 0 || outgoing.length > 0) && (
          <div>
            <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">Fluxos</div>
            {outgoing.length > 0 && <FlowList flows={outgoing} node={p.node} onEditFlow={p.onEditFlow} />}
            {incoming.length > 0 && <FlowList flows={incoming} node={p.node} onEditFlow={p.onEditFlow} />}
          </div>
        )}
        {!one && <Linked nodes={p.nodes} onPick={p.onPick} />}
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-neutral-800 px-3 py-2.5">
        {one?.kind === 'session' && <Button size="sm" icon="terminal" onClick={() => p.onOpenTerm(one.id)}>terminal</Button>}
        {one?.kind === 'session' && <Button variant="secondary" size="sm" icon="message" onClick={() => p.onOpenSession(one.ref)}>abrir chat</Button>}
        {card && card.status === 'todo' && <Button size="sm" icon="play" onClick={() => p.onRunCard(card)}>rodar agente</Button>}
        {card && <Button variant="secondary" size="sm" icon="pencil" onClick={() => p.onEditCard(card.id)}>editar</Button>}
        {!card && <Button variant={one?.kind === 'session' ? 'secondary' : 'primary'} size="sm" icon="zap" onClick={() => p.onNewCard('task')}>agente aqui</Button>}
        {!card && <Button variant="secondary" size="sm" icon="sparkles" onClick={() => p.onNewCard('content')}>gerar conteúdo</Button>}
        {pair && <Button size="sm" icon="zap" onClick={() => p.onChainSelected(pair[0].id, pair[1].id)}>encadear {pair[0].title} → {pair[1].title}</Button>}
      </div>
    </aside>
  );
}
