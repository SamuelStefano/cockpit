import { useEffect, useState } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamState, TeamStateBot } from '../../../shared/team-state';
import { Badge, Button, EmptyState, SkeletonCards } from '../../components/primitives';
import { TeamTabs } from '../../components/chrome/team/TeamTabs';
import type { NavRole } from '../../components/chrome/nav-routes';
import { BotSection } from './BotSection';
import { FollowUps } from './FollowUps';
import { usePersisted } from '../../lib/persist';
import { RECORDING_MODE_DEFAULT, RECORDING_MODE_KEY } from '../../lib/prefs';
import { ago, followUpKey, nameOf, nudgeText, primaryBot, sectionsOf } from './team-home';

interface EquipeHomeProps {
  state: TeamState | null;
  bots: TeamBot[];
  connected: boolean;
  onLoad: () => void;
  onOpenAgent: (id: string) => void;
  onSendTo: (sessionId: string, text: string) => boolean;
  now?: number;
  role?: NavRole;
}

export function EquipeHome({ state, bots, connected, onLoad, onOpenAgent, onSendTo, now, role = 'admin' }: EquipeHomeProps) {
  const [recording, setRecording] = usePersisted<boolean>(RECORDING_MODE_KEY, RECORDING_MODE_DEFAULT);
  const [draft, setDraft] = useState('');
  const [failedNudge, setFailedNudge] = useState<string | null>(null);
  useEffect(() => { if (connected) onLoad(); }, [connected, onLoad]);

  const primary = primaryBot(bots);
  const send = () => {
    const text = draft.trim();
    if (!text || !primary?.sessionId) return;
    if (onSendTo(primary.sessionId, text)) setDraft('');
  };
  const nudge = (i: number) => {
    if (!state) return;
    const f = state.followUps[i];
    const target = bots.find((b) => b.id === f.to);
    if (!target?.sessionId) return;
    const sent = onSendTo(target.sessionId, nudgeText(nameOf(state, f.from), nameOf(state, f.to), ago((now ?? Date.now()) - f.at)));
    setFailedNudge(sent ? null : followUpKey(f));
  };
  const hasSession = (id: string) => !!bots.find((b) => b.id === id)?.sessionId;

  const sections = state ? sectionsOf(state) : null;
  const clock = now ?? Date.now();

  const headerActions = (
    <>
      {sections && <Badge tone="green">{sections.working.length} trabalhando</Badge>}
      <button
        type="button" role="switch" aria-checked={recording} onClick={() => setRecording(!recording)}
        className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${recording ? 'border-orange-500/50 bg-orange-500/15 text-orange-300' : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'}`}
      >Modo gravação</button>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TeamTabs role={role} active="pedidos" counts={{ pedidos: state?.followUps.length }} actions={headerActions} />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-225 px-4 pb-8 pt-5 sm:px-7">
        {!state || !sections ? <SkeletonCards /> : !state.bots.length ? (
          <EmptyState size="sm" icon="users" title="Sem bots na equipe" />
        ) : (
          <>
            <p className="mb-4 text-[14px] text-neutral-500">{state.bots.length} bots</p>
            {state.followUps.length > 0 && <FollowUps state={state} clock={clock} failedNudge={failedNudge} hasSession={hasSession} onNudge={nudge} />}
            <BotSection title="Precisam de você" bots={sections.waiting} recording={recording} onOpen={onOpenAgent} />
            <BotSection title="Trabalhando agora" bots={sections.working} recording={recording} onOpen={onOpenAgent} />
          </>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2 pl-3.5">
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Pedir algo para a equipe…" aria-label="Pedir algo para a equipe"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-neutral-100 placeholder:text-neutral-500 focus:outline-hidden"
          />
          {!primary?.sessionId && <span className="text-[12px] text-neutral-500">bot principal sem sessão</span>}
          <Button type="submit" size="sm" disabled={!draft.trim() || !primary?.sessionId}>Enviar</Button>
        </form>
      </div>
      </div>
    </div>
  );
}
