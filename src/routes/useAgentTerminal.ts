import { useCallback, useRef, useState } from 'react';
import type { AgentStepKind } from '../../shared/agents';
import { createStepEndScanner, typedCommand } from '../cockpit/agent-terminal';
import type { TermApi } from '../cockpit/useTerminals';

export interface RunningStep {
  kind: AgentStepKind;
  command: string;
}

export interface AgentTerminalApi {
  termId: string;
  open: boolean;
  running: RunningStep | null;
  run: (kind: AgentStepKind, command: string) => void;
  finish: () => void;
  hide: () => void;
  onOutput: (data: string, replay: boolean) => void;
}

// One Deck terminal per agent. The command waits for the PTY's first output
// before it is typed: keys sent before the tmux session exists are dropped.
export function useAgentTerminal(term: TermApi, termId: string, onStepEnd: (kind: AgentStepKind) => void): AgentTerminalApi {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<RunningStep | null>(null);
  const ready = useRef(false);
  const pending = useRef<string | null>(null);
  const scan = useRef(createStepEndScanner());
  const runningRef = useRef<RunningStep | null>(null);
  const endRef = useRef(onStepEnd);
  endRef.current = onStepEnd;

  const type = useCallback((command: string) => {
    scan.current = createStepEndScanner();
    term.input(termId, typedCommand(command));
  }, [term, termId]);

  const finish = useCallback(() => {
    const step = runningRef.current;
    runningRef.current = null;
    setRunning(null);
    if (step) endRef.current(step.kind);
  }, []);

  const run = useCallback((kind: AgentStepKind, command: string) => {
    const step = { kind, command };
    runningRef.current = step;
    setRunning(step);
    setOpen(true);
    if (ready.current) type(command);
    else pending.current = command;
  }, [type]);

  const onOutput = useCallback((data: string, replay: boolean) => {
    if (!ready.current) {
      ready.current = true;
      const cmd = pending.current;
      pending.current = null;
      if (cmd) type(cmd);
      return;
    }
    if (replay || !runningRef.current) return;
    if (scan.current(data) !== null) finish();
  }, [type, finish]);

  const hide = useCallback(() => {
    ready.current = false;
    pending.current = null;
    runningRef.current = null;
    setRunning(null);
    setOpen(false);
  }, []);

  return { termId, open, running, run, finish, hide, onOutput };
}
