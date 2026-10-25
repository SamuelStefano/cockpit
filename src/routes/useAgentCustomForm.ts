import { useCallback, useEffect, useRef, useState } from 'react';
import { AGENT_ID_RE, type AgentCustomField } from '../../shared/agents';
import { parseCommandLine, slugFromName, type CustomSaveGate } from '../cockpit/agents-view';
import type { AgentsApi, CustomAgentDraft } from '../cockpit/useAgents';
import type { TermApi } from '../cockpit/useTerminals';
import { useAgentTerminal } from './useAgentTerminal';

export const NEW_AGENT_TERM_ID = 'agent-new';

interface FormDeps {
  agents: AgentsApi;
  gate: CustomSaveGate;
  term: TermApi;
  onSaved: (id: string) => void;
}

export function useAgentCustomForm({ agents, gate, term, onSaved }: FormDeps) {
  const [name, setName] = useState('');
  const [idInput, setIdInput] = useState<string | null>(null);
  const [commandLine, setCommandLine] = useState('');
  const [install, setInstall] = useState('');
  const [login, setLogin] = useState('');
  const terminal = useAgentTerminal(term, NEW_AGENT_TERM_ID, () => {});

  const id = idInput ?? slugFromName(name);
  const { command, args } = parseCommandLine(commandLine);
  const draft: CustomAgentDraft = {
    id, name: name.trim(), command, args,
    ...(install.trim() ? { install: install.trim() } : {}),
    ...(login.trim() ? { login: login.trim() } : {}),
  };
  const idBad = id !== '' && !AGENT_ID_RE.test(id);
  const complete = AGENT_ID_RE.test(id) && draft.name !== '' && command !== '';
  const { customBusy: busy, customOutcome: outcome, clearCustomOutcome, addCustom, probeDraft } = agents;

  useEffect(() => { clearCustomOutcome(); }, [clearCustomOutcome]);
  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;
  const lastSaved = useRef<string | null>(null);
  useEffect(() => {
    if (outcome?.kind === 'save' && outcome.ok && lastSaved.current) {
      savedRef.current(lastSaved.current);
      lastSaved.current = null;
    }
  }, [outcome]);

  const canAct = gate.allowed && complete && busy === null;
  const probe = useCallback(() => { if (canAct) probeDraft(draft); }, [canAct, probeDraft, draft]);
  const save = useCallback(() => {
    if (!canAct) return;
    if (addCustom(draft)) lastSaved.current = draft.id;
  }, [canAct, addCustom, draft]);
  const errorFor = (field: AgentCustomField): string | undefined =>
    outcome && !outcome.ok && outcome.field === field ? outcome.message : undefined;

  return {
    name, setName, id, setId: (v: string) => setIdInput(v), commandLine, setCommandLine, install, setInstall, login, setLogin,
    idBad, complete, canAct, busy, outcome, errorFor, probe, save, terminal,
    runInstall: () => { if (gate.allowed && install.trim()) terminal.run('install', install.trim()); },
  };
}
