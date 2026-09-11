import { useEffect, useRef, useState } from 'react';
import type { Cron, ModelInfo, PlanUsage } from '../../shared/protocol';
import { EmptyState, Skeleton, RouteHeader } from '../components/primitives';
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

        <div ref={formRef}>
          <CronForm form={form} onCancel={form.reset} now={now} planUsage={planUsage} models={models} />
        </div>

        {loaded && <CronTimeline slots={upcomingSlots(crons, now)} now={now} />}

        {!loaded && connected
          ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[74px] w-full rounded-xl" />)}</div>
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
                  onToggle={() => onCronSave({ ...c, enabled: !c.enabled })}
                  onEdit={() => startEdit(c)}
                  onDelete={() => onCronDelete(c.id)}
                />
              ))}
            </div>}
      </div>
    </div>
  );
}
