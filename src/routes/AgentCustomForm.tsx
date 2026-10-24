import { Button, Input } from '../components/primitives';
import type { AgentsApi } from '../cockpit/useAgents';
import { useAgentCustomForm } from './useAgentCustomForm';

export function AgentCustomForm({ onAdd }: { onAdd: AgentsApi['addCustom'] }) {
  const f = useAgentCustomForm(onAdd);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input size="sm" className="min-w-0 flex-1" placeholder="id (ex: meu-agente)" aria-label="ID do agente" mono error={f.idBad} aria-invalid={f.idBad} value={f.id} onChange={(e) => f.setId(e.target.value)} />
        <Input size="sm" className="min-w-0 flex-1" placeholder="Nome (ex: Meu agente)" aria-label="Nome do agente" value={f.name} onChange={(e) => f.setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input size="sm" className="min-w-0 flex-1" placeholder="comando (ex: meu-cli)" aria-label="Comando do agente" mono value={f.command} onChange={(e) => f.setCommand(e.target.value)} />
        <Input size="sm" className="min-w-0 flex-1" placeholder="argumentos (ex: acp --stdio)" aria-label="Argumentos do agente" mono value={f.args} onChange={(e) => f.setArgs(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && f.submit()} />
      </div>
      {f.idBad && <p role="alert" className="text-[11px] text-red-300">ID inválido: minúsculas, números e hífen, começando por letra (máx. 32).</p>}
      <div><Button variant="secondary" size="sm" icon="plus" onClick={f.submit} disabled={!f.valid}>Adicionar agente</Button></div>
    </div>
  );
}
