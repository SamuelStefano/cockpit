import { openBox } from '../../../cockpit/box-open';
import { useBoxUnread } from '../../../cockpit/box-unread';
import { useBoxSwitcher } from '../../sessions/useBoxSwitcher';

export function useBoxChip(onAdd: () => void) {
  const s = useBoxSwitcher();
  const unread = useBoxUnread();
  let red = 0;
  let white = 0;
  for (const [id, u] of Object.entries(unread)) {
    if (id === s.active) continue;
    red += u.red;
    white += u.white;
  }
  return {
    s, unread, other: { red, white },
    select: (id: string) => { s.close(); openBox(id, s.active, s.select); },
    add: () => { s.close(); onAdd(); },
  };
}
