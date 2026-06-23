import { useState, useEffect } from 'react';
import type { Cron, CronSchedule, PermMode } from '../../shared/protocol';
import { Button, Icon, Badge, EmptyState } from '../components/primitives';

interface Props {
  connected: boolean;
  crons: Cron[];
  onCronsGet: () => void;
  onCronSave: (cron: Cron) => void;
  onCronDelete: (id: string) => void;
  onCronRun: (id: string) => void;
}

function scheduleLabel(s: CronSchedule): string {
  if (s.kind === 'interval') {
    const m = s.everyMinutes ?? 60;
    return m % 60 === 0 ? `a cada ${m / 60}h` : `a cada ${m}min`;
  }
  const at = s.atMinute ?? 540;
  return `todo dia ${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
}
function fmtLast(ts?: number): string {
  if (!ts) return 'nunca rodou';
  const d = new Date(ts);
  return `último: ${d.toLocaleDateString('pt-BR')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function newId(): string {
  try { return crypto.randomUUID(); } catch { return `c${Date.now().toString(36)}`; }
}

// Agendador: dispara prompts em horário marcado (turnos autônomos). Cada cron vira
// uma sessão `cron-<id>` no chat quando roda.
export function Crons({ connected, crons, onCronsGet, onCronSave, onCronDelete, onCronRun }: Props) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<'interval' | 'daily'>('daily');
  const [everyMinutes, setEveryMinutes] = useState(60);
  const [time, setTime] = useState('09:00');
  const [model, setModel] = useState('');
  const [mode, setMode] = useState<PermMode>('plan');

  useEffect(() => { if (connected) onCronsGet(); }, [connected, onCronsGet]);

  const add = () => {
    if (!name.trim() || !prompt.trim()) return;
    const [h, m] = time.split(':').map((x) => parseInt(x, 10));
    const schedule: CronSchedule = kind === 'interval'
      ? { kind: 'interval', everyMinutes: Math.max(1, everyMinutes) }
      : { kind: 'daily', atMinute: (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0) };
    onCronSave({ id: newId(), name: name.trim(), prompt: prompt.trim(), schedule, model: model || undefined, mode, enabled: true, createdAt: Date.now() });
    setName(''); setPrompt('');
  };

  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-4">
          <h1 className="text-[19px] font-semibold tracking-tight text-neutral-100">Crons</h1>
          <p className="text-[12.5px] text-neutral-500">Prompts agendados — disparam turnos autônomos no horário marcado.</p>
        </header>

        <div className="mb-5 space-y-2.5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex: resumo diário)"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-orange-500/40" />
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Prompt a enviar…" rows={2}
            className="scroll-thin w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-[13px] text-neutral-200 placeholder-neutral-600 outline-none focus:border-orange-500/40" />
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <select value={kind} onChange={(e) => setKind(e.target.value as 'interval' | 'daily')} className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-neutral-200">
              <option value="daily">Diário</option>
              <option value="interval">Intervalo</option>
            </select>
            {kind === 'daily'
              ? <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-neutral-200" />
              : <span className="flex items-center gap-1 text-neutral-400">a cada <input type="number" min={1} value={everyMinutes} onChange={(e) => setEveryMinutes(parseInt(e.target.value, 10) || 60)} className="w-16 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-neutral-200" /> min</span>}
            <select value={mode} onChange={(e) => setMode(e.target.value as PermMode)} className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-neutral-200">
              <option value="plan">Planejar</option>
              <option value="acceptEdits">Executar</option>
            </select>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-neutral-200">
              <option value="">modelo padrão</option>
              <option value="sonnet">Sonnet</option>
              <option value="opus">Opus</option>
              <option value="haiku">Haiku</option>
            </select>
            <Button variant="primary" size="sm" onClick={add} disabled={!name.trim() || !prompt.trim()}><Icon name="plus" size={14} /> Criar</Button>
          </div>
        </div>

        {crons.length === 0
          ? <EmptyState icon="clock" title="Nenhum cron" description="Crie um prompt agendado acima — ele dispara sozinho no horário." />
          : <div className="space-y-2">
              {crons.map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-neutral-100">{c.name}</span>
                      <Badge tone={c.enabled ? 'green' : 'neutral'}>{c.enabled ? 'ativo' : 'pausado'}</Badge>
                      <span className="text-[11px] text-neutral-500">{scheduleLabel(c.schedule)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-neutral-400">{c.prompt}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-600">{fmtLast(c.lastRun)}{c.model ? ` · ${c.model}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" icon="play" title="Rodar agora" onClick={() => onCronRun(c.id)} />
                    <Button variant="ghost" size="sm" icon={c.enabled ? 'square' : 'play'} title={c.enabled ? 'Pausar' : 'Ativar'} onClick={() => onCronSave({ ...c, enabled: !c.enabled })} />
                    <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={() => onCronDelete(c.id)} />
                  </div>
                </div>
              ))}
            </div>}
      </div>
    </div>
  );
}
