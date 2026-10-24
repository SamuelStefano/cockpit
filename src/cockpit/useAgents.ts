import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import type { AgentPreset, AgentStatus, AgentView } from '../../shared/agents';

export interface AgentTestResult {
  id: string;
  ok: boolean;
  status: AgentStatus;
  message: string;
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
  addCustom: (a: { id: string; name: string; command: string; args: string[] }) => boolean;
}

export function useAgents(send: (m: ClientMsg) => boolean) {
  const [items, setItems] = useState<AgentView[]>([]);
  const [presets, setPresets] = useState<AgentPreset[]>([]);
  const [customAllowed, setCustomAllowed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [testing, setTesting] = useState<ReadonlySet<string>>(new Set());
  const [lastTest, setLastTest] = useState<AgentTestResult | null>(null);

  const onMsg = useCallback((msg: ServerMsg) => {
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
    return false;
  }, []);

  const agents: AgentsApi = {
    items, presets, customAllowed, loaded, testing, lastTest,
    refresh: useCallback(() => { send({ t: 'agents-get' }); }, [send]),
    connect: useCallback((preset: string) => { send({ t: 'agent-connect', preset }); }, [send]),
    test: useCallback((id: string) => {
      if (!send({ t: 'agent-test', id })) return;
      setTesting((prev) => new Set(prev).add(id));
    }, [send]),
    remove: useCallback((id: string) => { send({ t: 'agent-remove', id }); }, [send]),
    addCustom: useCallback((a) => send({ t: 'agent-add-custom', ...a }), [send]),
  };
  return { agents, onMsg };
}
