import type { ReactNode } from 'react';
import type { BoxInfo } from '../../../shared/boxes';
import { BoxHeader } from './BoxHeader';
import { OtherBoxSection } from './OtherBoxSection';

interface Props {
  grouped: boolean;
  current: BoxInfo | null;
  others: BoxInfo[];
  currentOpen: boolean;
  toggleCurrent: () => void;
  count: number;
  openOn: (box: string, sessionId: string) => void;
  children: ReactNode;
}

export function BoxGroups({ grouped, current, others, currentOpen, toggleCurrent, count, openOn, children }: Props) {
  if (!grouped || !current) return <>{children}</>;
  return (
    <>
      <BoxHeader box={current} open={currentOpen} onToggle={toggleCurrent} current count={count} />
      {currentOpen && children}
      <div className="mt-2 space-y-1 border-t border-neutral-800/80 pt-2">
        {others.map((b) => <OtherBoxSection key={b.id} box={b} onOpen={openOn} />)}
      </div>
    </>
  );
}
