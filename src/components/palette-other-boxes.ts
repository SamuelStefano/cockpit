import type { SessionMeta } from '../../shared/protocol';
import type { BoxInfo } from '../../shared/boxes';
import { boxLabel } from '../cockpit/boxes-store';
import type { Cmd } from './command-palette-types';

const MAX = 100;

// Only while searching: listing every box's chats would bury the empty palette.
export function otherBoxCommands(query: string, boxes: BoxInfo[], byBox: Record<string, SessionMeta[]>, open: (box: string, sessionId: string) => void): Cmd[] {
  if (!query.trim()) return [];
  const out: Cmd[] = [];
  for (const b of boxes) {
    for (const s of byBox[b.id] ?? []) {
      if (out.length >= MAX) return out;
      out.push({ id: `box-${b.id}-${s.id}`, label: s.title || 'Conversa', hint: boxLabel(b), icon: 'message', group: 'Outras máquinas', run: () => open(b.id, s.id) });
    }
  }
  return out;
}
