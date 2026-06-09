import { Icon } from '../../components/primitives';

export function Empty() {
  return (
    <div className="mt-16 flex flex-col items-center px-4 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-600">
        <Icon name="zap" size={18} />
      </div>
      <p className="text-[12.5px] font-medium text-neutral-400">Sem dados de uso ainda</p>
      <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">Os tokens são registrados conforme você conversa com o agente.</p>
    </div>
  );
}
