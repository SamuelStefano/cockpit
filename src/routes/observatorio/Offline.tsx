import { Icon } from '../../components/primitives';

export function Offline() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-600">
        <Icon name="circle" size={20} />
      </div>
      <p className="text-[13px] font-medium text-neutral-300">Backend local indisponível</p>
      <p className="mt-1 max-w-sm text-[12px] leading-snug text-neutral-600">
        O histórico de uso vive no SQLite local e só aparece com o backend do Deck rodando em <span className="font-mono">127.0.0.1</span>.
      </p>
    </div>
  );
}
