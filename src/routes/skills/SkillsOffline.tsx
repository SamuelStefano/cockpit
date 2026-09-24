import { EmptyState } from '../../components/primitives';

// "Only with the backend on 127.0.0.1" predated the relay and the phone path;
// the skills come from whichever machine this Deck is connected to.
export function SkillsOffline() {
  return (
    <EmptyState
      icon="circle"
      title="Desconectado"
      description={<>
        As skills ficam na máquina conectada (<span className="font-mono">~/.claude/skills/</span>). Reconecte pra ver.
      </>}
    />
  );
}
