import { plural, type ActivitySummary } from '../activity';

interface Props { sum: ActivitySummary; subagents: number; failedOnly: boolean; onToggleFailed: () => void }

export function LiveStats({ sum, subagents, failedOnly, onToggleFailed }: Props) {
  return (
    <div className="stats">
      <span>{plural(sum.commands, 'command')}</span><span>{plural(sum.reads, 'read')}</span><span>{plural(sum.agents, 'agent')}</span>
      {subagents > 0 && <span>{plural(subagents, 'subagent')} running</span>}
      {(sum.failed > 0 || failedOnly) && <button type="button" className={`bad${failedOnly ? ' on' : ''}`} aria-pressed={failedOnly} onClick={onToggleFailed}>{sum.failed} failed</button>}
    </div>
  );
}
