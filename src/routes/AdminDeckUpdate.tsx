import { Badge, Button, Icon } from '../components/primitives';
import type { AdminHealth } from '../../shared/protocol';
import { AdminConfirm } from './AdminConfirm';
import { dur } from './adminFormat';
import { useDeckUpdate } from './useDeckUpdate';

// Atualização do CLI do Claude e restart do Deck pelo app. O caso que motivou:
// modelo novo recusado com "Claude Code X does not support this model" enquanto
// o agente rodava há semanas com o CLI (e o código) do dia do boot.

interface AdminDeckUpdateProps {
  health: AdminHealth | null;
  adminOp: { ok: boolean; message: string } | null;
  onCliUpdate: () => void;
  onDeckRestart: (mode: 'idle' | 'now') => void;
}

export function AdminDeckUpdate({ health, adminOp, onCliUpdate, onDeckRestart }: AdminDeckUpdateProps) {
  const u = useDeckUpdate(adminOp, onCliUpdate, onDeckRestart);
  const cli = health?.claudeCli;
  const deck = health?.deck;
  const behind = !!deck && !!deck.headCommit && deck.bootCommit !== deck.headCommit;
  const flying = deck?.inFlight ?? 0;

  return (
    <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <h2 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
        <Icon name="rotate" size={12} /> Claude Code e Deck
      </h2>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 text-[12.5px] text-neutral-300">
          <span className="text-neutral-500">CLI do Claude</span>{' '}
          <span className="font-mono text-neutral-100">{cli?.version || '—'}</span>
          {cli?.path && <span className="ml-2 font-mono text-[11px] text-neutral-600">{cli.path}</span>}
        </div>
        <Button variant="secondary" size="sm" icon="download" onClick={u.updateCli} disabled={u.busy !== null || !health} loading={u.busy === 'cli'}>
          Atualizar CLI
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 text-[12.5px] text-neutral-300">
          <span className="text-neutral-500">Servidor do Deck</span>{' '}
          <span className="font-mono text-neutral-100">{deck?.bootCommit || '—'}</span>
          {health && <span className="ml-2 text-[11px] text-neutral-600">no ar há {dur(health.uptimeSec)}</span>}
          <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
            {behind && <Badge tone="yellow" dot>código novo no disco: {deck!.headCommit}</Badge>}
            {deck?.restartArmed && <Badge tone="orange" dot>restart agendado</Badge>}
            {flying > 0 && <Badge tone="neutral">{flying} turno{flying > 1 ? 's' : ''} em voo</Badge>}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" icon="clock" onClick={u.restartIdle} disabled={u.busy !== null || !health || !!deck?.restartArmed} loading={u.busy === 'restart' && !u.confirmNow}>
            Reiniciar quando ocioso
          </Button>
          <Button variant="danger" size="sm" icon="zap" onClick={u.askRestartNow} disabled={u.busy !== null || !health}>
            Reiniciar agora
          </Button>
        </div>
      </div>

      {u.confirmNow && (
        <AdminConfirm
          heading="Reiniciar o Deck agora?"
          icon="zap"
          tone="danger"
          cta="Reiniciar"
          body={<>
            Backend e agente caem por alguns segundos e todas as abas reconectam.
            {flying > 0
              ? <> <span className="font-mono text-neutral-200">{flying}</span> turno{flying > 1 ? 's' : ''} em voo {flying > 1 ? 'são' : 'é'} interrompido{flying > 1 ? 's' : ''} e retomado{flying > 1 ? 's' : ''} no boot.</>
              : ' Nenhum turno em voo agora.'}
          </>}
          onConfirm={u.restartNow}
          onCancel={u.cancelRestartNow}
        />
      )}
    </div>
  );
}
