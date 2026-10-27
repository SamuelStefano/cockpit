import type { SmokeResult } from '../../../shared/box-health';
import { LevelIcon } from './LevelIcon';
import { HealthHint } from './HealthHint';

export function SmokeResultLine({ smoke }: { smoke: SmokeResult | null }) {
  if (!smoke) return null;
  if (smoke.state === 'running') {
    return <div className="flex items-start gap-2 text-[12.5px] text-neutral-300"><LevelIcon state="active" />Mandando um prompt de teste (haiku)…</div>;
  }
  const secs = smoke.ms ? ` em ${(smoke.ms / 1000).toFixed(1)}s` : '';
  return (
    <div className="flex items-start gap-2">
      <LevelIcon state={smoke.ok ? 'ok' : 'error'} />
      <div className="min-w-0 flex-1">
        <p className={`text-[12.5px] ${smoke.ok ? 'text-green-300' : 'text-red-300'}`}>
          {smoke.ok ? `O prompt de teste respondeu${secs}.` : `O prompt de teste falhou${secs}.`}
        </p>
        {!smoke.ok && smoke.error && <p className="mt-0.5 break-words font-mono text-[11px] text-neutral-400">{smoke.error}</p>}
        {!smoke.ok && smoke.hint && <HealthHint text={smoke.hint} />}
      </div>
    </div>
  );
}
