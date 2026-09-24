import { useEffect, useRef, useState } from 'react';
import type { Cron, ModelInfo, PlanUsage } from '../../shared/protocol';
import { Button, EmptyState, Skeleton, RouteHeader } from '../components/primitives';
import { useLoadStalled } from '../lib/useLoadStalled';
import { useCronForm } from './crons/useCronForm';
import { CronForm } from './crons/CronForm';
import { CronCard } from './crons/CronCard';
import { CronTimeline } from './crons/CronTimeline';
import { upcomingSlots } from './crons/cron-timeline';

interface Props {
  connected: boolean;
  crons: Cron[];
  loaded: boolean;
  onCronsGet: () => void;
  onCronSave: (cron: Cron) => void;
  onCronDelete: (id: string) => void;
  onCronRun: (id: string) => void;
  planUsage?: PlanUsage | null;
  models: ModelInfo[];
}

// Agendador: dispara prompts em horário marcado (turnos autônomos). Cada cron vira
// uma sessão `cron-<id>` no chat quando roda.
// Pausing is always allowed; turning a one-time cron back ON only if its moment is
// still ahead.
export function canToggleOn(c: Cron, now: number): boolean {
  if (c.enabled) return true;
  return c.schedule.kind !== 'once' || (c.schedule.atMs ?? 0) > now;
}

export function Crons({ connected, crons, loaded, onCronsGet, onCronSave, onCronDelete, onCronRun, planUsage, models }: Props) {
  const form = useCronForm(onCronSave);
  const formRef = useRef<HTMLDivElement>(null);
  // The form sits above the list, so editing a card further down changed state
  // off-screen and the button looked like it did nothing.
  const startEdit = (c: Cron) => {
    form.startEdit(c);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      formRef.current?.querySelector('input')?.focus({ preventScroll: true });
    });
  };
  // Relógio que avança a cada 30s pra os "em Xmin" não congelarem na tela aberta.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { if (connected) onCronsGet(); }, [connected, onCronsGet]);
  const { stalled, retry } = useLoadStalled(loaded, connected);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const active = crons.filter((c) => c.enabled).length;

  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <RouteHeader
          variant="page"
          title="Crons"
          subtitle={
            <>
              <span>Prompts agendados — disparam turnos autônomos no horário marcado (Brasília).</span>
              {crons.length > 0 && <span className="tabular-nums text-neutral-600">{active} ativo{active === 1 ? '' : 's'} de {crons.length}</span>}
            </>
          }
        />

        {!connected ? (
          <EmptyState icon="circle" title="Desconectado" description="Reconecte pra ver e agendar crons." />
        ) : (<>
        <div ref={formRef}>
          <CronForm form={form} onCancel={form.reset} now={now} planUsage={planUsage} models={models} />
        </div>

        {loaded && <CronTimeline slots={upcomingSlots(crons, now)} now={now} />}

        {!loaded
          ? stalled
            ? <EmptyState icon="x" title="Não deu pra carregar os crons" description="O servidor não respondeu com a lista. Tente de novo.">
                <Button icon="rotate" onClick={() => { retry(); onCronsGet(); }}>Tentar de novo</Button>
              </EmptyState>
            : <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[74px] w-full rounded-xl" />)}</div>
          : crons.length === 0
          ? <EmptyState icon="clock" title="Nenhum cron" description="Crie um prompt agendado acima — ele dispara sozinho no horário." />
          : <div className="space-y-2">
              {crons.map((c) => (
                <CronCard
                  key={c.id}
                  cron={c}
                  now={now}
                  editing={form.draft.id === c.id}
                  onRun={() => onCronRun(c.id)}
                  // A one-time cron whose moment already passed cannot just be
                  // re-enabled: it would fire at the next tick (the case
                  // enabledFor blocks on save). Open it to pick a new time.
                  onToggle={() => (canToggleOn(c, now) ? onCronSave({ ...c, enabled: !c.enabled }) : startEdit(c))}
                  onEdit={() => startEdit(c)}
                  // Deleting the cron open in the form must close the form, or
                  // "Salvar" would recreate it under the same id.
                  onDelete={() => { if (form.draft.id === c.id) form.reset(); onCronDelete(c.id); }}
                />
              ))}
            </div>}
        </>)}
      </div>
    </div>
  );
}
