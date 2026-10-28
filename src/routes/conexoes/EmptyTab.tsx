import { Bit } from '../../components/bit/Bit';
import { Button } from '../../components/primitives';
import { EMPTY_COPY, type ConnTab } from './connection-view';

export function EmptyTab({ tab, onConnect }: { tab: ConnTab; onConnect?: () => void }) {
  const { title, text } = EMPTY_COPY[tab];
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-700 px-6 py-10 text-center">
      <Bit state="idle" size={40} />
      <h3 className="text-[15px] font-semibold text-neutral-200">{title}</h3>
      <p className="max-w-md text-[13px] leading-relaxed text-neutral-500">{text}</p>
      {onConnect && <Button icon="plus" onClick={onConnect}>Conectar o primeiro</Button>}
    </div>
  );
}
