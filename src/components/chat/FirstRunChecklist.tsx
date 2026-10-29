import { Button, Icon } from '../primitives';
import { Bit } from '../bit/Bit';
import { usePersisted } from '../../lib/persist';
import { EMPTY_STEPS, ONBOARDING_STEPS_KEY, firstRunDone, firstRunSteps, type OnboardingSteps } from '../../lib/gamify/first-run';

const isStandalone = () => typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;

// Speech bubble from the Bit with the three first-run steps; hides once all are done.
export function FirstRunChecklist({ providerConnected }: { providerConnected: boolean }) {
  const [saved, setSaved] = usePersisted<OnboardingSteps>(ONBOARDING_STEPS_KEY, EMPTY_STEPS);
  const steps = firstRunSteps(providerConnected, saved, isStandalone());
  if (firstRunDone(steps)) return null;
  return (
    <div className="bit-greet mt-4 flex w-full max-w-sm items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3 text-left">
      <Bit state="wave" size={36} still />
      <ol className="min-w-0 flex-1 space-y-1.5" aria-label="Primeiros passos">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-[14px]">
            <Icon name={s.done ? 'check' : 'circle'} size={14} className={s.done ? 'text-green-400' : 'text-neutral-600'} />
            <span className={s.done ? 'text-neutral-500 line-through' : 'text-neutral-200'}>{s.label}</span>
            {s.id === 'install' && !s.done && (
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSaved((p) => ({ ...p, install: true }))}>Já fiz</Button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
