import { useEffect, useMemo } from 'react';
import { BoxPeek, type PeekState, type TurnSummary } from '../cockpit/box-peek';
import { boxUnreadStore, loadSeen, NO_UNREAD, saveSeen, unreadLevels } from '../cockpit/box-unread';
import { mergeSeen } from '../cockpit/session';
import { WAITING_DISMISSED_KEY } from '../lib/prefs';
import { loadPref } from '../lib/persist';
import { useBoxes } from '../cockpit/useBoxes';
import { dial, isEnrolled } from '../cockpit/useBoxPeek';
import { notifyTurnDone, notifyTurnError } from '../lib/notify';
import { chatPath } from '../useRoute';

export function turnTitle(state: PeekState | undefined, turn: TurnSummary): string {
  const id = turn.sessionId || turn.sessionKey;
  return state?.sessions.find((s) => s.id === id)?.title ?? '';
}

// A key with no session id yet ("new-…") has no chat to open: the box alone is the target.
export function turnTarget(turn: TurnSummary): string | null {
  return turn.sessionId || (turn.sessionKey.startsWith('new-') ? null : turn.sessionKey);
}

function publishUnread(box: string, state: PeekState): void {
  if (state.status === 'locked') { boxUnreadStore.set(box, { ...NO_UNREAD, locked: true }); return; }
  // An empty list is the peek still connecting, not a box with no sessions: merging it would prune every baseline.
  if (state.status !== 'open' || state.sessions.length === 0) return;
  const { next, changed } = mergeSeen(loadSeen(box), state.sessions);
  if (changed) saveSeen(box, next);
  const dismissed = new Set(Object.keys(loadPref<Record<string, number>>(WAITING_DISMISSED_KEY, {})));
  boxUnreadStore.set(box, { ...unreadLevels(state.sessions, next, '', new Set(state.busy), dismissed), locked: false });
}

// The active box notifies through its own socket; this covers the others, over
// summary peeks so they stay lean on the box. Phones skip it to save battery.
export function useOtherBoxToasts(enabled: boolean): void {
  const { boxes, active, switchBox } = useBoxes();
  const key = useMemo(
    () => (enabled ? boxes.filter((b) => b.online && b.id !== active).map((b) => b.id).sort().join(',') : ''),
    [enabled, boxes, active],
  );
  useEffect(() => {
    boxUnreadStore.retain(new Set([...(key ? key.split(',') : []), ...(active ? [active] : [])]));
    if (!key) return;
    const peeks = key.split(',').map((box) => {
      let state: PeekState | undefined;
      return new BoxPeek(box, {
        dial,
        isEnrolled,
        onChange: (s) => { state = s; publishUnread(box, s); },
        onTurn: (turn) => {
          const open = () => {
            const target = turnTarget(turn);
            if (target) history.pushState(null, '', chatPath(target));
            switchBox(box);
          };
          const title = turnTitle(state, turn);
          if (turn.ok) notifyTurnDone(title, open);
          else notifyTurnError(title, '', open);
        },
      });
    });
    return () => { for (const p of peeks) p.dispose(); };
  }, [key, active, switchBox]);
}
