import type { BotView } from '../../routes/equipe/team-view';

// Orange: waits on you. Blue: said something unread. Green: online and quiet.
export function TeamDot({ view, className = '' }: { view: BotView; className?: string }) {
  const pending = !!view.pending;
  const label = pending ? 'esperando você' : view.unread ? 'mensagem nova' : 'online';
  const color = pending ? 'bg-orange-500' : view.unread ? 'bg-sky-500' : 'bg-green-500';
  return <span role="img" aria-label={label} className={`h-2 w-2 shrink-0 rounded-full ring-2 ring-neutral-950 ${color} ${className}`} />;
}
