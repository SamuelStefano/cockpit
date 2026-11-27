import { useCallback, useEffect, useState } from 'react';
import type { TeamBot, TeamBotInput } from '../../../shared/protocol';
import { toast } from '../../components/primitives';
import type { BotView } from '../equipe/team-view';
import { copyInput } from './agent-list';

const ARRIVAL_TIMEOUT_MS = 10_000;

interface Input {
  views: BotView[];
  onSave?: (bot: TeamBotInput) => void;
  onDelete?: (id: string) => void;
  onProfile: (id: string) => void;
}

export function useAgentActions({ views, onSave, onDelete, onProfile }: Input) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<TeamBot | null>(null);

  useEffect(() => {
    if (!pendingId) return;
    if (views.some((v) => v.bot.id === pendingId)) {
      setPendingId(null);
      toast('Agente duplicado');
      onProfile(pendingId);
      return;
    }
    const t = setTimeout(() => {
      setPendingId(null);
      toast('Não consegui confirmar a cópia. Confira a equipe.', { tone: 'error' });
    }, ARRIVAL_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [pendingId, views, onProfile]);

  const duplicate = useCallback((bot: TeamBot) => {
    if (!onSave || pendingId) return;
    const input = copyInput(bot, views.map((v) => v.bot));
    onSave(input);
    setPendingId(input.id);
  }, [onSave, pendingId, views]);

  const confirmDelete = () => {
    if (toDelete && onDelete) { onDelete(toDelete.id); toast(`${toDelete.name} excluído`); }
    setToDelete(null);
  };

  return {
    canManage: !!onSave && !!onDelete,
    duplicate,
    busy: pendingId !== null,
    toDelete,
    askDelete: setToDelete,
    cancelDelete: () => setToDelete(null),
    confirmDelete,
  };
}
