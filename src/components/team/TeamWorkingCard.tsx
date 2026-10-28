import { useEffect, useState } from 'react';
import type { BotView } from '../../routes/equipe/team-view';
import { Mascot } from './Mascot';
import { LivingPhrase } from './LivingPhrase';
import { agoLabel, clockLabel, earliestStart, rowStatus } from './team-working';

const NOW_MS = 30_000;

interface TeamWorkingCardProps {
  rows: BotView[];
  leaving?: boolean;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), NOW_MS); return () => clearInterval(t); }, []);
  return now;
}

export function TeamWorkingCard({ rows, leaving = false }: TeamWorkingCardProps) {
  const now = useNow();
  const start = earliestStart(rows);
  return (
    <section
      aria-label="Equipe trabalhando"
      className={`flex flex-col gap-0.5 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3.5 pb-1.5 pt-2.5 transition-opacity duration-200 ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex items-center gap-2 pb-1.5 text-[12px] text-neutral-500">
        <b className="font-medium text-neutral-300">Equipe trabalhando</b>
        {start !== undefined && <span className="ml-auto hidden sm:inline">começou {agoLabel(start, now)}</span>}
      </div>
      {rows.map((v) => <TeamWorkingRow key={v.bot.id} view={v} now={now} />)}
    </section>
  );
}

function TeamWorkingRow({ view: v, now }: { view: BotView; now: number }) {
  const live = v.state === 'thinking' || v.state === 'working';
  const { phrase, faint } = rowStatus(v);
  const time = live && v.startedAt !== undefined ? agoLabel(v.startedAt, now) : v.state === 'done' && v.endedAt !== undefined ? clockLabel(v.endedAt) : '';
  return (
    <div className="flex h-8 items-center gap-2.5 text-[14px]">
      <Mascot mascot={v.bot.mascot} state={v.state} size={24} name={v.bot.name} />
      <span className="w-[84px] shrink-0 truncate font-medium text-neutral-100 sm:w-24">{v.bot.name}</span>
      <span className={`min-w-0 flex-1 ${faint ? 'text-neutral-500' : 'text-neutral-400'}`}>
        {live ? <LivingPhrase active startedAt={v.startedAt} /> : <span className="block truncate">{phrase}</span>}
      </span>
      <span className="hidden shrink-0 text-[12px] text-neutral-500 sm:inline">{time}</span>
    </div>
  );
}
