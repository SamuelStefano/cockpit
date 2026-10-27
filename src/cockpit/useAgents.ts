import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { useVersions, type VersionsApi } from './useVersions';
import type { AgentCustomField, AgentPreset, AgentStatus, AgentView } from '../../shared/agents';

export interface AgentTestResult {
  id: string;
  ok: boolean;
  status: AgentStatus;
  message: string;
}

export interface CustomAgentDraft {
  id: string;
  name: string;
  command: string;
  args: string[];
  install?: string;
  login?: string;
}

export interface CustomAgentOutcome {
  kind: 'save' | 'probe';
  ok: boolean;
  status?: AgentStatus;
  message: string;
  field?: AgentCustomField;
}

export interface AgentsApi {
  items: AgentView[];
  presets: AgentPreset[];
  customAllowed: boolean;
  loaded: boolean;
  testing: ReadonlySet<string>;
  lastTest: AgentTestResult | null;
  refresh: () => void;
  connect: (preset: string) => void;
  test: (id: string) => void;
  remove: (id: string) => void;
  addCustom: (a: CustomAgentDraft) => boolean;
  probeDraft: (a: CustomAgentDraft) => boolean;
  customBusy: 'save' | 'probe' | null;
  customOutcome: CustomAgentOutcome | null;
  clearCustomOutcome: () => void;
  versions: VersionsApi;
}

export function useAgents(send: (m: ClientMsg) => boolean) {
  const [items, setItems] = useState<AgentView[]>([]);
  const [presets, setPresets] = useState<AgentPreset[]>([]);
  const [customAllowed, setCustomAllowed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [testing, setTesting] = useState<ReadonlySet<string>>(new Set());
  const [lastTest, setLastTest] = useState<AgentTestResult | null>(null);
  const [customBusy, setCustomBusy] = useState<'save' | 'probe' | null>(null);
  const [customOutcome, setCustomOutcome] = useState<CustomAgentOutcome | null>(null);

  const versions = useVersions(send, 'agent');
  const onVersionsMsg = versions.onMsg;

  const onMsg = useCallback((msg: ServerMsg) => {
    if (onVersionsMsg(msg)) return true;
    if (msg.t === 'agents') {
      setItems(msg.items);
      setPresets(msg.presets);
      setCustomAllowed(msg.customAllowed);
      setLoaded(true);
      return true;
    }
    if (msg.t === 'agent-test-result') {
      setTesting((prev) => { const n = new Set(prev); n.delete(msg.id); return n; });
      setLastTest({ id: msg.id, ok: msg.ok, status: msg.status, message: msg.message });
      return true;
    }
    if (msg.t === 'agent-custom-result') {
      setCustomBusy(null);
      setCustomOutcome({ kind: 'save', ok: msg.ok, message: msg.message, field: msg.field });
      return true;
    }
    if (msg.t === 'agent-draft-result') {
      setCustomBusy(null);
      setCustomOutcome({ kind: 'probe', ok: msg.ok, status: msg.status, message: msg.message, field: msg.field });
      return true;
    }
    return false;
  }, [onVersionsMsg]);

  const agents: AgentsApi = {
    items, presets, customAllowed, loaded, testing, lastTest, customBusy, customOutcome,
    refresh: useCallback(() => { send({ t: 'agents-get' }); }, [send]),
    connect: useCallback((preset: string) => { send({ t: 'agent-connect', preset }); }, [send]),
    test: useCallback((id: string) => {
      if (!send({ t: 'agent-test', id })) return;
      setTesting((prev) => new Set(prev).add(id));
    }, [send]),
    remove: useCallback((id: string) => { send({ t: 'agent-remove', id }); }, [send]),
    addCustom: useCallback((a: CustomAgentDraft) => {
      if (!send({ t: 'agent-add-custom', ...a })) return false;
      setCustomBusy('save');
      setCustomOutcome(null);
      return true;
    }, [send]),
    probeDraft: useCallback((a: CustomAgentDraft) => {
      if (!send({ t: 'agent-probe-draft', id: a.id, name: a.name, command: a.command, args: a.args })) return false;
      setCustomBusy('probe');
      setCustomOutcome(null);
      return true;
    }, [send]),
    clearCustomOutcome: useCallback(() => setCustomOutcome(null), []),
    versions: versions.api,
  };
  return { agents, onMsg };
}
