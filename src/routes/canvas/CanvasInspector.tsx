import type { CanvasCard, CanvasNode } from '../../../shared/canvas';
import { Badge, Button, Icon } from '../../components/primitives';
import { STATUS_LABEL, STATUS_TONE } from './canvas-labels';

interface Props {
  nodes: CanvasNode[];
  linked: (id: string) => CanvasNode[];
  card: (id: string) => CanvasCard | undefined;
  running: Set<string>;
  onPick: (id: string) => void;
  onOpenSession: (id: string) => void;
  onNewCard: (kind: CanvasCard['kind']) => void;
  onEditCard: (id: string) => void;
  onRunCard: (card: CanvasCard) => void;
  onClose: () => void;
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

export function CanvasInspector(p: Props) {
  const one = p.nodes.length === 1 ? p.nodes[0] : null;
  const card = one?.kind === 'card' ? p.card(one.ref) : undefined;
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
              <Badge tone={one.kind === 'card' ? 'orange' : 'neutral'}>{one.kind === 'session' ? 'sessão' : one.kind === 'card' ? 'card' : one.hub ? 'hub' : 'contexto'}</Badge>
              {one.kind === 'session' && p.running.has(one.ref) && <Badge tone="green" dot>rodando</Badge>}
              {one.archived && <Badge>arquivo</Badge>}
              {card && <Badge tone={STATUS_TONE[card.status]}>{STATUS_LABEL[card.status]}</Badge>}
            </div>
            <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-neutral-400">{card ? card.prompt || '—' : one.subtitle || '—'}</p>
            {one.path && <p className="break-all font-mono text-[10px] text-neutral-600">{one.path}</p>}
          </div>
        )}
        {one && (
          <div>
            <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">Ligações</div>
            <Linked nodes={p.linked(one.id)} onPick={p.onPick} />
          </div>
        )}
        {!one && <Linked nodes={p.nodes} onPick={p.onPick} />}
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-neutral-800 px-3 py-2.5">
        {one?.kind === 'session' && <Button size="sm" icon="message" onClick={() => p.onOpenSession(one.ref)}>abrir chat</Button>}
        {card && card.status === 'todo' && <Button size="sm" icon="play" onClick={() => p.onRunCard(card)}>rodar agente</Button>}
        {card && <Button variant="secondary" size="sm" icon="pencil" onClick={() => p.onEditCard(card.id)}>editar</Button>}
        {!card && <Button variant={one?.kind === 'session' ? 'secondary' : 'primary'} size="sm" icon="zap" onClick={() => p.onNewCard('task')}>agente aqui</Button>}
        {!card && <Button variant="secondary" size="sm" icon="sparkles" onClick={() => p.onNewCard('content')}>gerar conteúdo</Button>}
      </div>
    </aside>
  );
}
