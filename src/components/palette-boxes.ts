import type { BoxInfo } from '../../shared/boxes';
import { boxLabel } from '../cockpit/boxes-store';
import type { Cmd } from './command-palette-types';

export const BOX_GROUP = 'Máquinas';

// The sidebar no longer lists machines: this is how ⌘K switches (or starts a chat on) another one.
export function boxSwitchCommands(boxes: BoxInfo[], active: string | null, open: (box: string) => void, newOn: (box: string) => void): Cmd[] {
  const out: Cmd[] = [];
  for (const b of boxes) {
    if (b.id === active) continue;
    const hint = b.online ? 'online' : 'offline';
    out.push({ id: `switch-box-${b.id}`, label: `Trocar de máquina: ${boxLabel(b)}`, hint, icon: 'monitor', group: BOX_GROUP, run: () => open(b.id) });
    if (b.online) out.push({ id: `new-on-box-${b.id}`, label: `Nova conversa em ${boxLabel(b)}`, icon: 'plus', group: BOX_GROUP, run: () => newOn(b.id) });
  }
  return out;
}
