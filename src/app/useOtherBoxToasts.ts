import { useEffect, useMemo } from 'react';
import { BoxPeek, type PeekState, type TurnSummary } from '../cockpit/box-peek';
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

// The active box notifies through its own socket; this covers the others, over
// summary peeks so they stay lean on the box. Phones skip it to save battery.
export function useOtherBoxToasts(enabled: boolean): void {
  const { boxes, active, switchBox } = useBoxes();
  const key = useMemo(
    () => (enabled ? boxes.filter((b) => b.online && b.id !== active).map((b) => b.id).sort().join(',') : ''),
    [enabled, boxes, active],
  );
  useEffect(() => {
    if (!key) return;
    const peeks = key.split(',').map((box) => {
      let state: PeekState | undefined;
      return new BoxPeek(box, {
        dial,
        isEnrolled,
        onChange: (s) => { state = s; },
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
  }, [key, switchBox]);
}
