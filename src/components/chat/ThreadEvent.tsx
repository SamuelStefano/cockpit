import type { ReactNode } from 'react';
import { Icon } from '../primitives';

interface ThreadEventProps {
  children: ReactNode;
}

export function ThreadEvent({ children }: ThreadEventProps) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-neutral-500">
      <Icon name="clock" size={12} />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

export const eventName = (name: string) => <b className="font-medium text-neutral-400">{name}</b>;

export function routineEvent(name: string, ranAt: number): ReactNode {
  const at = new Date(ranAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  return <>Rotina {eventName(name)} rodou às {at}</>;
}

export function memoryEvent(name: string): ReactNode {
  return <>Atualizou a memória {eventName(name)}</>;
}
