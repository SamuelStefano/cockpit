import { AgentCopyLine } from './AgentCopyLine';

const EXAMPLE = '{"agents":[{"id":"meu-agente","name":"Meu agente","command":"meu-cli","args":["acp"]}]}';

export function AgentCustomManual() {
  return (
    <div className="text-[12px] leading-relaxed text-neutral-400">
      <p>Por segurança, um comando personalizado só pode ser adicionado na própria máquina: edite <code className="font-mono text-neutral-200">~/.deck-agent/agents.json</code> e reinicie o Deck. Qualquer CLI que fale ACP funciona.</p>
      <AgentCopyLine command={EXAMPLE} />
    </div>
  );
}
