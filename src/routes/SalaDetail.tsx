import type { BotComputer } from '../../shared/protocol';
import type { SessionPeek } from '../../shared/canvas';
import { Badge, Button } from '../components/primitives';
import { PULSE_LABEL, type SalaNode } from './sala/model';

interface Props {
  node: SalaNode | undefined;
  computer?: BotComputer;
  computerError?: string;
  peek?: SessionPeek | null;
  onOpen: (sessionId: string) => void;
}

export function SalaDetail({ node, computer, computerError, peek, onOpen }: Props) {
  if (!node) return <p className="text-[13px] text-neutral-500">Ninguém no mapa ainda.</p>;
  const lines = computer?.preview.slice(-8) ?? [];
  const said = peek?.lastAssistant?.trim();
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 border-t border-neutral-800 p-4 lg:w-80 lg:border-l lg:border-t-0">
      <div>
        <Badge tone={node.pulse === 'working' ? 'orange' : node.pulse === 'error' ? 'red' : node.pulse === 'waiting' ? 'yellow' : 'neutral'} dot>
          {PULSE_LABEL[node.pulse]}
        </Badge>
        <h2 className="mt-2 text-[16px] font-semibold text-neutral-100">{node.title}</h2>
        <p className="text-[12px] text-neutral-500">{node.subtitle}</p>
      </div>
      <p className="text-[13px] leading-relaxed text-neutral-300">{said || node.detail || 'Sem fala recente.'}</p>
      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">Computador</p>
        {computerError && <p className="text-[12px] text-red-300">{computerError}</p>}
        {!computer && !computerError && <p className="text-[12px] text-neutral-500">Lendo o terminal…</p>}
        {computer && (
          <>
            <p className="mb-1 font-mono text-[11px] text-neutral-500">{computer.files} arquivos · {computer.termAlive ? 'terminal vivo' : 'terminal quieto'}</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-900 p-2 font-mono text-[11px] leading-relaxed text-neutral-300">
              {lines.length > 0 ? lines.join('\n') : 'Sem linhas novas.'}
            </pre>
          </>
        )}
      </div>
      <Button variant="primary" size="sm" disabled={!node.sessionId} onClick={() => node.sessionId && onOpen(node.sessionId)}>
        Abrir chat
      </Button>
    </aside>
  );
}
