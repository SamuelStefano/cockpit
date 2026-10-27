import { useMemo, useState } from 'react';
import { useBoxes } from '../../cockpit/useBoxes';
import { requestNewOn } from '../../cockpit/box-intent';
import { chatPath } from '../../useRoute';
import { sortBoxes } from './useBoxSwitcher';

// The sidebar groups sessions by box once the account has more than one: the
// current box first (its live list), then the others as read-only peeks.
// Opening another box's session only sets the URL before the switch: the remount
// restores the chat from it, and the current box never hears of that id.
export function useBoxGroups({ onNew }: { onNew: () => void }) {
  const { boxes, active, switchBox } = useBoxes();
  const [currentOpen, setCurrentOpen] = useState(true);
  const current = boxes.find((b) => b.id === active) ?? null;
  const others = useMemo(() => sortBoxes(boxes.filter((b) => b.id !== active)), [boxes, active]);

  const openOn = (box: string, sessionId: string) => {
    history.pushState(null, '', chatPath(sessionId));
    switchBox(box);
  };
  const newOn = (box: string) => {
    if (box === active) { onNew(); return; }
    requestNewOn(box);
    switchBox(box);
  };

  return {
    grouped: !!current && others.length > 0,
    current, others, currentOpen, toggleCurrent: () => setCurrentOpen((v) => !v), openOn, newOn,
    choices: current ? [current, ...others] : others,
  };
}
