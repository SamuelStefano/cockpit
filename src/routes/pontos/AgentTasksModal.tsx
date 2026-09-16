import { useState } from 'react';
import { Modal, Button, Badge, toast } from '../../components/primitives';
import { usePontosControls } from './pontosControls';
import { currentMonthKey } from './month-cap';
import { EPIC_CAP_CENTS } from './epic-cap';
import { brl } from './money';

// Dispara um agente que registra no DFL o trabalho descrito aqui. O Deck não
// escreve nada: quem cria épico/delivery/task é o agente, com as tools dele. Este
// modal existe pra ele ver, ANTES de disparar, as duas regras que o prompt carrega.
export function AgentTasksModal({ onClose }: { onClose: () => void }) {
  const { write, pointValue, monthCapCents } = usePontosControls();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const monthCap = monthCapCents(currentMonthKey(Date.now()));

  const fire = async () => {
    if (busy) return;
    setBusy(true);
    const r = await write.onPontosAgent({ note, epicCapCents: EPIC_CAP_CENTS, monthCapCents: monthCap, pointValue });
    setBusy(false);
    if (r.ok) { toast('Agente disparado — acompanhe em Sessões'); onClose(); }
    else toast(r.message ?? 'não consegui disparar o agente', { tone: 'error', durationMs: 8000 });
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Criar tasks com agente"
      icon="zap"
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={fire} loading={busy}>Disparar agente</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-neutral-400">O que registrar</span>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} rows={5} autoFocus
            placeholder="Ex: lesson studio, PRs mergeadas desde segunda. Ou deixe vazio e o agente varre as PRs sozinho."
            className="scroll-thin w-full resize-y rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-[12.5px] text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-orange-500/40"
          />
        </label>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2.5">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-500">Regras que vão no prompt</span>
          <ul className="mt-2 flex flex-col gap-1.5 text-[11.5px] text-neutral-400">
            <li className="flex gap-2">
              <Badge tone="orange">1</Badge>
              <span>Um épico rende no máximo <span className="tabular-nums text-neutral-200">{brl(EPIC_CAP_CENTS)}</span>. Valeu mais? Quebra em vários épicos — nunca corta pontos.</span>
            </li>
            <li className="flex gap-2">
              <Badge tone="neutral">2</Badge>
              <span>O mês pode ter dezenas de épicos muito acima do teto de <span className="tabular-nums text-neutral-200">{brl(monthCap)}</span>. O teto do mês limita só a fatura; o resto espera.</span>
            </li>
          </ul>
        </div>

        <p className="text-[11px] text-neutral-600">
          O agente registra o valor real do trabalho e não fatura nada. Faturar continua sendo clique seu, na seleção da árvore.
        </p>
      </div>
    </Modal>
  );
}
