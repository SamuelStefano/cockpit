import { useState, useRef, useEffect } from 'react';
import type { Cron } from '../../../shared/protocol';
import { scheduleLabel, nextRunAt } from '../../../shared/cron-schedule';
import { Button, Icon, Badge, toast, tokens } from '../../components/primitives';
import { prettyModel } from '../../components/chat/toolbar-format';
import { fmtLast } from './cron-format';


// "em 2h 5min" / "em 40s" / "agora". now passado de fora pra ser determinístico.
export function fmtIn(target: number, now: number): string {
  const ms = target - now;
  if (ms <= 0) return 'agora';
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'em <1min';
  if (min < 60) return `em ${min}min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  if (h < 24) return rem ? `em ${h}h ${rem}min` : `em ${h}h`;
  // floor, not round: 36h read as "em 2d".
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `em ${d}d ${rh}h` : `em ${d}d`;
}

export function CronCard({ cron, now, editing, onRun, onToggle, onEdit, onDelete }: {
  cron: Cron;
  now: number;
  editing: boolean;
  onRun: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Excluir em dois estágios: 1º clique arma "confirmar?" por 3s; 2º clique dentro
  // da janela executa. Evita exclusão acidental sem um modal.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const clickDelete = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (confirmDelete) { setConfirmDelete(false); onDelete(); return; }
    setConfirmDelete(true);
    confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
  };

  // A double tap sent two cron-run frames, and the second fireCron replaced the
  // first turn mid-flight. Ignore re-taps for a moment.
  const [firing, setFiring] = useState(false);
  useEffect(() => {
    if (!firing) return;
    const t = setTimeout(() => setFiring(false), 3000);
    return () => clearTimeout(t);
  }, [firing]);
  const run = () => { if (firing) return; setFiring(true); onRun(); toast('Cron disparado'); };

  return (
    <div className={`flex flex-col gap-1 rounded-xl border bg-neutral-900/50 p-3 transition sm:flex-row sm:items-start sm:gap-3 ${editing ? 'border-orange-500/40 glow-active' : 'border-neutral-800 hairline hover:border-neutral-700'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-neutral-100">{cron.name}</span>
          <Badge tone={cron.enabled ? 'green' : 'neutral'} dot>{cron.enabled ? 'ativo' : 'pausado'}</Badge>
          <span className="flex items-center gap-1 text-[11px] text-neutral-500"><Icon name="clock" size={10} />{scheduleLabel(cron.schedule)}</span>
          {cron.enabled && (
            <span className="text-[11px] font-medium tabular-nums text-orange-300/80">{fmtIn(nextRunAt(cron, now), now)}</span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] text-neutral-400">{cron.prompt}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-neutral-600">
          <span>{fmtLast(cron.lastRun)}</span>
          {cron.model && <span title={cron.model}>· {prettyModel(cron.model)}</span>}
          {cron.mode === 'acceptEdits' && <span>· executa</span>}
          {cron.effort && cron.effort !== 'low' && <span>· pensar: {cron.effort}</span>}
        </p>
      </div>
      {/* Below sm the four 40px actions sit on their own row: beside the text they
          took 176px of a 326px card and cut the name to "Cron com nome muito…". */}
      <div className="-mb-1 flex shrink-0 items-center gap-1 self-end sm:mb-0 sm:self-auto">
        {/* "Rodar agora" and "Ativar" both used ▶, and "Pausar" used ■ (reads as
            "stop the run"). Pause/resume get their own icons; every action is named
            and 40px on touch. */}
        <Button variant="ghost" size="sm" icon="play" title="Rodar agora" aria-label="Rodar agora" className={tokens.touchBox} onClick={run} disabled={firing} />
        <Button variant="ghost" size="sm" icon="pencil" title="Editar" aria-label="Editar" className={tokens.touchBox} onClick={onEdit} />
        <Button variant="ghost" size="sm" icon={cron.enabled ? 'pause' : 'clock'} title={cron.enabled ? 'Pausar' : 'Reativar agendamento'} aria-label={cron.enabled ? 'Pausar' : 'Reativar agendamento'} className={tokens.touchBox} onClick={onToggle} />
        {confirmDelete
          ? <Button variant="danger" size="sm" className={`text-red-400 ${tokens.touchBox}`} title="Confirmar exclusão" onClick={clickDelete}>confirmar?</Button>
          : <Button variant="ghost" size="sm" icon="trash" title="Excluir" aria-label="Excluir" className={tokens.touchBox} onClick={clickDelete} />}
      </div>
    </div>
  );
}
