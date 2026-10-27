import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { boxHealthStore } from '../../cockpit/box-health-store';
import { boxStore } from '../../cockpit/boxes-store';
import { useBoxes } from '../../cockpit/useBoxes';
import { findNewBox, setupChecklist, setupWatch, type SetupChecklist } from '../../cockpit/setup-watch';
import { useSealState } from '../auth/useEnrollDevice';
import { useBoxHealthState } from './useBoxHealthPanel';

const TICK_MS = 15_000;

// A pairing screen showing the checklist inline hides the floating card, so the
// same progress is never on screen twice.
let inlineViews = 0;
const inlineListeners = new Set<() => void>();
const inlineStore = {
  subscribe: (fn: () => void) => { inlineListeners.add(fn); return () => { inlineListeners.delete(fn); }; },
  get: () => inlineViews,
  add: (d: number) => { inlineViews += d; for (const fn of inlineListeners) fn(); },
};

export function useSetupWatch() {
  return useSyncExternalStore(setupWatch.subscribe, setupWatch.get);
}

// Starts the checklist from the copy button: the boxes the account has right now
// are the "before", so the next new id is the machine being set up.
export function startSetupWatch(label = ''): void {
  setupWatch.start((boxStore.get().frame?.boxes ?? []).map((b) => b.id), label);
}

export interface SetupChecklistApi {
  checklist: SetupChecklist | null;
  covered: boolean;
  switchTo: () => void;
  retry: () => void;
  dismiss: () => void;
}

// `inline`: rendered inside a pairing screen. Only the floating card (always
// mounted in the app) fires the automatic test prompt.
export function useSetupChecklist(inline = false): SetupChecklistApi {
  const watch = useSetupWatch();
  const { boxes, active, known, switchBox } = useBoxes();
  const seal = useSealState();
  const health = useBoxHealthState();
  const [now, setNow] = useState(() => Date.now());
  const covered = useSyncExternalStore(inlineStore.subscribe, inlineStore.get) > 0;

  useEffect(() => {
    if (!inline) return;
    inlineStore.add(1);
    return () => inlineStore.add(-1);
  }, [inline]);

  const checklist = useMemo(() => {
    if (!watch) return null;
    const box = findNewBox(watch, boxes);
    const entry = health.byBox[box?.id ?? ''] ?? { health: null, smoke: null };
    return setupChecklist({ watch, boxes: known ? boxes : null, active, seal, health: entry.health, smoke: entry.smoke, now });
  }, [watch, boxes, known, active, seal, health, now]);

  const waiting = checklist?.phase === 'waiting';
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [waiting]);

  const boxId = checklist?.box?.id;
  useEffect(() => { if (boxId) setupWatch.bind(boxId); }, [boxId]);

  // The last proof is a real prompt: run it once, by itself, when the box is healthy.
  const needsSmoke = checklist?.needsSmoke === true;
  useEffect(() => {
    if (!inline && needsSmoke && boxId && boxHealthStore.requestSmoke(boxId)) setupWatch.markSmokeAsked();
  }, [inline, needsSmoke, boxId]);

  return {
    checklist,
    covered,
    switchTo: () => { if (boxId) switchBox(boxId); },
    retry: () => {
      boxHealthStore.requestHealth();
      if (boxId) boxHealthStore.requestSmoke(boxId);
    },
    dismiss: setupWatch.stop,
  };
}
