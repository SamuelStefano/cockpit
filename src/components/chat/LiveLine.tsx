import type { ReactNode } from 'react';
import { Bit } from '../bit/Bit';
import type { BitState } from '../bit/bit-state';
import { MascotStatusLine } from '../team/MascotStatusLine';
import { CompactingLine } from './CompactingLine';
import type { LiveTurn } from './Thinking';

interface LiveLineProps {
  live?: LiveTurn;
  bit?: BitState;
  avatar?: ReactNode;
  bare?: boolean;
}

export function LiveLine({ live, bit, avatar, bare }: LiveLineProps) {
  if (live?.compactingSince) return <CompactingLine since={live.compactingSince} />;
  return (
    <div className="flex items-center gap-2.5 pt-1.5">
      {!bare && (avatar ?? <Bit state={bit ?? 'working'} size={24} />)}
      <div className="min-w-0 [&>p]:p-0">
        <MascotStatusLine active startedAt={live?.startedAt} />
      </div>
    </div>
  );
}
