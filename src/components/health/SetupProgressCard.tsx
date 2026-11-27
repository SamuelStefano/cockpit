import { SetupChecklistView } from './SetupChecklistView';
import { useSetupChecklist } from './useSetupChecklist';

// Follows a machine being set up after the pairing screen is gone: the first
// machine's Dashboard unmounts as soon as the box comes online.
export function SetupProgressCard() {
  const s = useSetupChecklist();
  if (!s.checklist || s.covered || s.checklist.phase === 'waiting') return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-end sm:inset-x-auto sm:right-4">
      <div className="pointer-events-auto w-full max-w-sm shadow-xl shadow-black/40">
        <SetupChecklistView c={s.checklist} onSwitch={s.switchTo} onRetry={s.retry} onDismiss={s.dismiss} />
      </div>
    </div>
  );
}
