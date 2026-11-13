import type { TeamBot } from '../../../shared/protocol';
import { Badge, Button, Input } from '../../components/primitives';
import { sourceStatus } from './repo-source';

interface RepoSourceProps {
  repo: string;
  path: string;
  bot: TeamBot | null;
  onRepo: (v: string) => void;
  onPath: (v: string) => void;
  onSync?: (id: string) => void;
}

export function RepoSource({ repo, path, bot, onRepo, onPath, onSync }: RepoSourceProps) {
  const status = sourceStatus(bot);
  return (
    <div className="flex flex-col gap-2">
      <Input aria-label="Repositório" placeholder="dono/repositório (ex: devfellowship/agents)" value={repo} onChange={(e) => onRepo(e.target.value)} />
      <Input aria-label="Pasta" placeholder="pasta (ex: maria) — vazio = raiz" value={path} disabled={!repo.trim()} onChange={(e) => onPath(e.target.value)} />
      {status && (
        <div className="flex items-center gap-2">
          <Badge tone={status.tone}>{status.text}</Badge>
          {bot && onSync && <Button type="button" variant="ghost" size="sm" icon="rotate" onClick={() => onSync(bot.id)}>Sincronizar</Button>}
        </div>
      )}
    </div>
  );
}
