import { CodeBlock } from '../primitives';
import { AGENT_COMMANDS } from '../../app/diag/connectionCause';

const SCRIPT = [
  '# ver se o agente está rodando',
  AGENT_COMMANDS.status,
  '# últimas 80 linhas do log',
  AGENT_COMMANDS.logs,
  '# reiniciar o agente',
  AGENT_COMMANDS.restart,
  '# se continuar fora: atualizar e reiniciar',
  AGENT_COMMANDS.update,
].join('\n');

// Commands for an isolated install (systemd unit deck-agent, user deck).
export function BoxRecoverySteps() {
  return (
    <div className="mt-2 text-[12px]">
      <CodeBlock code={SCRIPT} lang="bash" />
    </div>
  );
}
