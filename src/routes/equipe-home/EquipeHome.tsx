import { useEffect, useState } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamState, TeamStateBot } from '../../../shared/team-state';
import { Badge, Button, EmptyState, SkeletonCards } from '../../components/primitives';
import { monogram, tintFor } from '../../cockpit/agents-view';
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
}

const DOT: Record<TeamStateBot['status'], string> = { working: 'bg-green-500', waiting: 'bg-yellow-400', idle: 'bg-neutral-600' };
const STATUS_LABEL: Record<TeamStateBot['status'], string> = { working: 'Trabalhando', waiting: 'Precisa de você', idle: 'Ociosa' };

function BotCard({ bot, recording, onOpen }: { bot: TeamStateBot; recording: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3.5 text-left transition hover:border-neutral-700">
      <span className="flex items-center gap-2.5">
        <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[14px] font-semibold ${tintFor(bot.id)}`}>
          {monogram(bot.name)}
          <span aria-hidden className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 ${DOT[bot.status]}`} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-neutral-100">{bot.name}</span>
          <span className="block truncate text-[12px] text-neutral-500">{bot.role}</span>
        </span>
      </span>
      {recording
        ? <span className="text-[12px] text-neutral-500">{STATUS_LABEL[bot.status]}</span>
        : bot.task && <span className="line-clamp-2 text-[14px] text-neutral-200">{bot.task}</span>}
    </button>
  );
}

function Section({ title, bots, recording, onOpen }: { title: string; bots: TeamStateBot[]; recording: boolean; onOpen: (id: string) => void }) {
  if (!bots.length) return null;
  return (
    <section aria-label={title} className="mb-6">
      <h2 className="mb-2 text-[12px] font-medium uppercase tracking-wider text-neutral-500">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {bots.map((b) => <BotCard key={b.id} bot={b} recording={recording} onOpen={() => onOpen(b.id)} />)}
      </div>
    </section>
  );
}

export function EquipeHome({ state, bots, connected, onLoad, onOpenAgent, onSendTo, now }: EquipeHomeProps) {
  const [recording, setRecording] = usePersisted<boolean>(RECORDING_MODE_KEY, RECORDING_MODE_DEFAULT);
  const [draft, setDraft] = useState('');
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
    if (target?.sessionId) onSendTo(target.sessionId, nudgeText(nameOf(state, f.from), nameOf(state, f.to), ago((now ?? Date.now()) - f.at)));
  };

  const sections = state ? sectionsOf(state) : null;
  const clock = now ?? Date.now();

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-350 px-4 pb-8 pt-4 sm:px-8">
        <header className="mb-4 flex items-center gap-2.5 border-b border-neutral-800 pb-3">
          <h1 className="font-display text-[20px] font-bold text-neutral-50">Equipe</h1>
          {sections && <Badge tone="green">{sections.working.length} trabalhando</Badge>}
          <span className="flex-1" />
          <button
            type="button" role="switch" aria-checked={recording} onClick={() => setRecording(!recording)}
            className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${recording ? 'border-orange-500/50 bg-orange-500/15 text-orange-300' : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'}`}
          >Modo gravação</button>
        </header>

        {!state || !sections ? <SkeletonCards /> : !state.bots.length ? (
          <EmptyState size="sm" icon="users" title="Sem bots na equipe" />
        ) : (
          <>
            <p className="mb-4 text-[14px] text-neutral-500">{state.bots.length} bots</p>
            {state.followUps.length > 0 && (
              <div role="alert" className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-red-400">{state.followUps.length} {state.followUps.length === 1 ? 'pedido sem resposta' : 'pedidos sem resposta'}</p>
                  <ul className="mt-1 space-y-1">
                    {state.followUps.map((f, i) => (
                      <li key={followUpKey(f)} className="flex items-center gap-2 text-[13px] text-neutral-300">
                        <span className="min-w-0 flex-1 truncate">{nameOf(state, f.from)} → {nameOf(state, f.to)} {ago(clock - f.at)}</span>
                        <Button size="xs" variant="outline" onClick={() => nudge(i)}>Cobrar</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <Section title="Precisam de você" bots={sections.waiting} recording={recording} onOpen={onOpenAgent} />
            <Section title="Trabalhando agora" bots={sections.working} recording={recording} onOpen={onOpenAgent} />
          </>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2 pl-3.5">
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Pedir algo para a equipe…" aria-label="Pedir algo para a equipe"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-neutral-100 placeholder:text-neutral-500 focus:outline-hidden"
          />
          <Button type="submit" size="sm" disabled={!draft.trim() || !primary?.sessionId}>Enviar</Button>
        </form>
      </div>
    </div>
  );
}
