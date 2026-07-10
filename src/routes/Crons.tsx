import { useEffect, useState } from 'react';
import type { Cron } from '../../shared/protocol';
import { EmptyState, Skeleton } from '../components/primitives';
import { useCronForm } from './crons/useCronForm';
import { CronForm } from './crons/CronForm';
import { CronCard } from './crons/CronCard';

interface Props {
  connected: boolean;
  crons: Cron[];
  loaded: boolean;
  onCronsGet: () => void;
  onCronSave: (cron: Cron) => void;
  onCronDelete: (id: string) => void;
  onCronRun: (id: string) => void;
}

// Agendador: dispara prompts em horário marcado (turnos autônomos). Cada cron vira
// uma sessão `cron-<id>` no chat quando roda.
export function Crons({ connected, crons, loaded, onCronsGet, onCronSave, onCronDelete, onCronRun }: Props) {
  const form = useCronForm(onCronSave);
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
        <header className="mb-4">
          <h1 className="text-[19px] font-semibold tracking-tight text-neutral-100">Crons</h1>
          <p className="text-[12.5px] text-neutral-500">
            Prompts agendados — disparam turnos autônomos no horário marcado.
            {crons.length > 0 && <span className="ml-1 tabular-nums text-neutral-600">{active} ativo{active === 1 ? '' : 's'} de {crons.length}.</span>}
          </p>
        </header>

        <CronForm form={form} onCancel={form.reset} now={now} />

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
                  onEdit={() => form.startEdit(c)}
                  onDelete={() => onCronDelete(c.id)}
                />
              ))}
            </div>}
      </div>
    </div>
  );
}
