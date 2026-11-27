import { useEffect, useMemo, useRef, useState } from 'react';
import type { SkillMeta } from '../../../shared/protocol';
import { applyBuilderReply, toggleSkill, type BuilderDraft, type BuilderTurn } from '../../../shared/agent-builder';
import type { AgentBuildRequest, AgentBuildResult } from '../../cockpit/useTeam';

export interface BuilderDeps {
  initial: BuilderDraft;
  skills: SkillMeta[];
  result: AgentBuildResult | null;
  onBuild: (req: AgentBuildRequest) => boolean;
}

export const BUILDER_ERRORS = { offline: 'Sem conexão com o Deck. Tente de novo em instantes.' } as const;

const greeting = (editing: boolean, name: string) =>
  editing ? `O que você quer mudar em ${name}?` : 'Oi! Me conta, em poucas palavras, o que esse agente vai fazer por você.';

let seq = 0;
const nextReqId = () => `ab${Date.now().toString(36)}${(seq++).toString(36)}`;

export function useBotBuilder({ initial, skills, result, onBuild }: BuilderDeps) {
  const editing = initial.name !== '';
  const [turns, setTurns] = useState<BuilderTurn[]>(() => [{ role: 'assistant', text: greeting(editing, initial.name) }]);
  const [draft, setDraft] = useState<BuilderDraft>(initial);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const known = useMemo(() => new Set(skills.map((s) => s.id)), [skills]);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!pending || !result || result.reqId !== pending) return;
    setPending(null);
    if (!result.ok || !result.text) { setError(result.error ?? 'Não consegui responder agora.'); return; }
    const applied = applyBuilderReply(draftRef.current, result.text, known);
    setDraft(applied.draft);
    setTurns((t) => [...t, { role: 'assistant', text: applied.message }]);
  }, [pending, result, known]);

  const send = () => {
    const text = input.trim();
    if (!text || pending) return;
    const history = [...turns, { role: 'user' as const, text }];
    const reqId = nextReqId();
    if (!onBuild({ reqId, history, draft })) { setError(BUILDER_ERRORS.offline); return; }
    setTurns(history);
    setInput('');
    setError(null);
    setPending(reqId);
  };

  return {
    turns, draft, input, setInput, pending: pending !== null, error, send,
    toggle: (id: string) => setDraft((d) => ({ ...d, skills: toggleSkill(d.skills, id) })),
    edit: (patch: Partial<BuilderDraft>) => setDraft((d) => ({ ...d, ...patch })),
  };
}
