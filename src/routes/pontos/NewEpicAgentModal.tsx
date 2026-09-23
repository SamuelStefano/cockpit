import { Modal, Button, Badge, Segmented } from '../../components/primitives';
import { useNewEpicAgent, type AgentTarget } from './useNewEpicAgent';
import { EPIC_CAP_CENTS } from './epic-cap';
import { brl } from './money';

const TARGETS: { id: AgentTarget; label: string }[] = [
  { id: 'drafts', label: 'rascunho no deck' },
  { id: 'dfl', label: 'direto no dfl' },
];

const HINT: Record<AgentTarget, string> = {
  drafts: 'O agente monta épico → deliveries → tasks aqui nos rascunhos (deck-drafts). Nada vai pro DFL até você revisar e clicar em criar.',
  dfl: 'O agente cria direto no DFL, sem passar pela sua revisão aqui. Use só pra algo pequeno e óbvio.',
};

// Describe the work in words; an agent turns it into the epic structure.
export function NewEpicAgentModal({ onClose }: { onClose: () => void }) {
  const a = useNewEpicAgent(onClose);
  return (
    <Modal
      open onClose={a.close} title="Novo épico com agente" icon="sparkles" maxWidth="max-w-xl"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={a.busy}>Cancelar</Button>
        <Button onClick={a.fire} loading={a.busy} icon="zap">{a.target === 'drafts' ? 'Montar rascunho' : 'Criar no DFL'}</Button>
      </>}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-neutral-400">O que o agente estrutura (esta é a nota exata que ele recebe)</span>
          <textarea
            value={a.note} onChange={(e) => a.setNote(e.target.value)} rows={5} autoFocus
            placeholder="Ex: lesson studio, PRs mergeadas desde segunda. Ou deixe vazio e o agente varre as PRs sozinho."
            className="scroll-thin w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[12.5px] text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-orange-500/40"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <Segmented label="Onde o agente escreve" items={TARGETS} value={a.target} onChange={a.setTarget} className="self-start" />
          <p className={`text-[11.5px] leading-snug ${a.target === 'dfl' ? 'text-yellow-300/90' : 'text-neutral-500'}`}>{HINT[a.target]}</p>
        </div>
        <ul className="flex flex-col gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2.5 text-[11.5px] text-neutral-400">
          <li className="flex gap-2">
            <Badge tone="orange">1</Badge>
            <span>Um épico rende no máximo <span className="tabular-nums text-neutral-200">{brl(EPIC_CAP_CENTS)}</span>. Valeu mais? Quebra em vários — nunca corta pontos.</span>
          </li>
          <li className="flex gap-2">
            <Badge>2</Badge>
            <span>O teto do mês (<span className="tabular-nums text-neutral-200">{brl(a.monthCap)}</span>) limita só a fatura. O agente não fatura nada.</span>
          </li>
        </ul>
      </div>
    </Modal>
  );
}
