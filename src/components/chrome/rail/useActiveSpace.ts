import { useCallback, useEffect, useRef, useState } from 'react';

export const ALL_SPACE = 'all';

// Which space the side shows: every conversation, or one agent. Opening an agent's
// thread anywhere moves the side to it; picking a plain chat leaves the side alone,
// so an agent's older threads stay one click away.
export function useActiveSpace(activeAgentId: string | null, agentIds: readonly string[]) {
  const [space, setSpace] = useState<string>(activeAgentId ?? ALL_SPACE);
  const prev = useRef(activeAgentId);
  useEffect(() => {
    if (activeAgentId && activeAgentId !== prev.current) setSpace(activeAgentId);
    prev.current = activeAgentId;
  }, [activeAgentId]);
  const current = space !== ALL_SPACE && !agentIds.includes(space) ? ALL_SPACE : space;
  return {
    space: current,
    agentId: current === ALL_SPACE ? null : current,
    selectAll: useCallback(() => setSpace(ALL_SPACE), []),
    selectAgent: useCallback((id: string) => setSpace(id), []),
  };
}
