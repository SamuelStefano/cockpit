import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SkillMeta, TeamBot, TeamBotInput } from '../../../../shared/protocol';
import { hireDrafts, type CatalogEntry } from '../../../../shared/agent-catalog';
import { newBotId } from '../../../../shared/team';
import { toast } from '../../../components/primitives';
import { hireBlock } from './hire-state';

export interface AgentStoreInput {
  bots: TeamBot[];
  skills: SkillMeta[];
  canEdit: boolean;
  onSave: (bot: TeamBotInput) => void;
  onHired: (firstId: string, count: number) => void;
}

interface Pending { ids: string[]; count: number }

const ARRIVAL_TIMEOUT_MS = 10_000;

export function useAgentStore({ bots, skills, canEdit, onSave, onHired }: AgentStoreInput) {
  const [pending, setPending] = useState<Pending | null>(null);
  const installed = useMemo(() => new Set(skills.map((s) => s.id)), [skills]);

  const hire = useCallback((entries: readonly CatalogEntry[]) => {
    if (pending || hireBlock(canEdit, bots.length, entries.length, false)) return;
    const drafts = hireDrafts(entries, bots, installed, newBotId);
    if (!drafts.length) return;
    for (const d of drafts) onSave(d);
    setPending({ ids: drafts.map((d) => d.id), count: drafts.length });
  }, [pending, canEdit, bots, installed, onSave]);

  useEffect(() => {
    if (!pending) return;
    if (pending.ids.every((id) => bots.some((b) => b.id === id))) {
      setPending(null);
      onHired(pending.ids[0], pending.count);
      return;
    }
    const t = setTimeout(() => {
      setPending(null);
      toast('Não consegui confirmar a contratação. Confira a equipe.', { tone: 'error' });
    }, ARRIVAL_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [pending, bots, onHired]);

  return {
    installed,
    busy: pending !== null,
    block: (adding: number) => hireBlock(canEdit, bots.length, adding, pending !== null),
    hire,
  };
}
