import { EmptyState } from '../components/primitives';
import { TeamRoster } from './equipe/TeamRoster';
import { BotThread } from './equipe/BotThread';
import { BotProfile } from './equipe/BotProfile';
import { BotForm } from './equipe/BotForm';
import { useEquipe } from './equipe/useEquipe';
import type { EquipeProps } from './equipe/equipe-props';

export function Equipe(p: EquipeProps) {
  const e = useEquipe(p);
  const sel = e.selectedView;
  const roster = <TeamRoster views={e.views} loaded={p.teamLoaded} selectedId={sel?.bot.id ?? null} onSelect={e.select} onNew={e.openNew} />;
  const form = e.form && (
    <BotForm key={e.form.mode === 'edit' ? e.form.bot.id : 'new'} bot={e.form.mode === 'edit' ? e.form.bot : null}
      bots={p.bots} models={p.models} onSave={p.onTeamSave} onClose={e.closeForm} />
  );
  const profile = (onBack?: () => void) => sel && (
    <BotProfile view={sel} bots={p.bots} models={p.models} onSave={p.onTeamSave} onEdit={e.openEdit} onDelete={p.onTeamDelete} onBack={onBack} />
  );

  if (p.isMobile) {
    const pane = sel ? e.pane : 'roster';
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
        {pane === 'roster' && roster}
        {pane === 'thread' && sel && <BotThread view={sel} chatProps={p.chatProps} onBack={() => e.setPane('roster')} onProfile={() => e.setPane('profile')} />}
        {pane === 'profile' && profile(() => e.setPane('thread'))}
        {form}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 bg-neutral-950">
      <aside className="w-72 shrink-0 border-r border-neutral-800">{roster}</aside>
      <main className="min-w-0 flex-1">
        {sel
          ? <BotThread view={sel} chatProps={p.chatProps} />
          : <EmptyState icon="message" title="Escolha um bot" description="Cada bot tem uma conversa só, que continua de onde parou." />}
      </main>
      {sel && <aside className="w-80 shrink-0 border-l border-neutral-800">{profile()}</aside>}
      {form}
    </div>
  );
}
