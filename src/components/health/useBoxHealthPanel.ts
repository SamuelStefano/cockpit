import { useEffect, useSyncExternalStore } from 'react';
import { boxHealthStore, healthLevel } from '../../cockpit/box-health-store';
import { boxLabel } from '../../cockpit/boxes-store';
import { useBoxes } from '../../cockpit/useBoxes';
import { useSealState } from '../auth/useEnrollDevice';

export function useBoxHealthState() {
  return useSyncExternalStore(boxHealthStore.subscribe, boxHealthStore.get);
}

export function useBoxHealthPanel() {
  const s = useBoxHealthState();
  const { boxes, active } = useBoxes();
  const sealed = useSealState() === 'sealed';
  const entry = boxHealthStore.entry(active);
  const box = boxes.find((b) => b.id === active) ?? null;
  const open = s.panelOpen;

  useEffect(() => { if (open && sealed) boxHealthStore.requestHealth(); }, [open, sealed]);

  return {
    open,
    close: boxHealthStore.closePanel,
    name: box ? boxLabel(box) : 'esta máquina',
    online: box?.online ?? true,
    sealed,
    health: entry.health,
    level: healthLevel(entry),
    smoke: entry.smoke,
    testing: entry.smoke?.state === 'running',
    refresh: () => { boxHealthStore.requestHealth(); },
    test: () => { boxHealthStore.requestSmoke(); },
  };
}
