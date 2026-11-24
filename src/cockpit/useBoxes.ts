import { useCallback, useSyncExternalStore } from 'react';
import { sanitizeBoxLabel, type BoxInfo } from '../../shared/boxes';
import { boxStore, currentBoxId } from './boxes-store';
import { sendRelayFrame } from './sealed-socket';

// Key for the remount: only the saved choice changes it. A box learned from the
// first `boxes` frame becomes the pref in the same step, so there is one remount.
export function useBoxes() {
  const s = useSyncExternalStore(boxStore.subscribe, boxStore.get);
  const boxes: BoxInfo[] = s.frame?.boxes ?? [];
  const current = s.pref;
  const active = currentBoxId(s);

  const switchBox = useCallback((id: string) => {
    if (id !== boxStore.get().pref) boxStore.setPref(id, null);
  }, []);
  const renameBox = useCallback((id: string, label: string) => {
    const clean = sanitizeBoxLabel(label);
    if (clean) sendRelayFrame({ t: 'box-rename', id, label: clean });
  }, []);
  const revokeBox = useCallback((id: string) => sendRelayFrame({ t: 'box-revoke', id }), []);

  return { known: s.frame !== null, boxes, current, active, switchBox, renameBox, revokeBox };
}
