import { Bit } from '../components/bit/Bit';
import { Button } from '../components/primitives';
import './agents.css';

interface AgentSuccessProps {
  name: string;
  celebrating: boolean;
  onOpenChat: () => void;
}

export function AgentSuccess({ name, celebrating, onOpenChat }: AgentSuccessProps) {
  return (
    <div className="agent-success flex flex-wrap items-center gap-3 rounded-xl border border-green-500/25 bg-green-500/5 p-3.5">
      <Bit state={celebrating ? 'happy' : 'idle'} size={52} />
      <p className="min-w-0 flex-1 basis-48 text-[13px] leading-snug text-neutral-200">
        <strong className="font-semibold text-green-300">Pronto!</strong> O {name} já aparece no seletor de modelo.
      </p>
      <Button variant="primary" size="md" icon="message" onClick={onOpenChat}>Abrir um chat com o {name}</Button>
    </div>
  );
}
