import { Button } from '../components/primitives';
import { AgentField } from './AgentField';
import type { useAgentCustomForm } from './useAgentCustomForm';

type Form = ReturnType<typeof useAgentCustomForm>;

export function AgentCustomForm({ f, locked }: { f: Form; locked: boolean }) {
  return (
    <fieldset disabled={locked} className="flex flex-col gap-3 disabled:opacity-60">
      <AgentField label="Nome" placeholder="Meu agente" value={f.name} onChange={f.setName} error={f.errorFor('name')} />
      <AgentField
        label="Comando ACP" mono placeholder="gemini --experimental-acp" value={f.commandLine} onChange={f.setCommandLine}
        help="O executável e os argumentos que fazem ele falar ACP." error={f.errorFor('command') ?? f.errorFor('args')}
      />
      <AgentField
        label="Instalar (opcional)" mono placeholder="npm install -g meu-cli" value={f.install} onChange={f.setInstall} error={f.errorFor('install')}
        action={<Button variant="secondary" size="sm" icon="terminal" disabled={!f.install.trim()} onClick={f.runInstall}>Rodar</Button>}
      />
      <AgentField label="Entrar (opcional)" mono placeholder="meu-cli login" value={f.login} onChange={f.setLogin} error={f.errorFor('login')} />
      <AgentField
        label="ID" mono placeholder="meu-agente" value={f.id} onChange={f.setId}
        help="Minúsculas, números e hífen. Vira agent:<id> no seletor."
        error={f.idBad ? 'Use minúsculas, números e hífen, começando por letra.' : f.errorFor('id')}
      />
    </fieldset>
  );
}
