// Pure predicate: show the "this is the Orchestrator" banner (Chat.tsx) only
// once we actually know the open session IS it — `orchestratorSessionId`
// undefined covers both "not answered yet" and "no Orchestrator configured",
// and either way there's nothing to warn about.
export function isOrchestratorSession(sessionId: string | undefined, orchestratorSessionId: string | undefined): boolean {
  return !!sessionId && !!orchestratorSessionId && sessionId === orchestratorSessionId;
}
