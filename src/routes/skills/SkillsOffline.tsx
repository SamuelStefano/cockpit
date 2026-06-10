import { EmptyState } from '../../components/primitives';

export function SkillsOffline() {
  return (
    <EmptyState
      icon="circle"
      title="Backend local indisponível"
      description={<>
        As skills vivem na sua máquina (<span className="font-mono">~/.claude/skills/</span>) e só aparecem com o backend do
        Deck rodando em <span className="font-mono">127.0.0.1</span>.
      </>}
    />
  );
}
