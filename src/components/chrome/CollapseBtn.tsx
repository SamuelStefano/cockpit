import { Icon } from '../primitives';

// Botão de recolher ancorado no canto superior-direito (área vazia em ambos os
// painéis). A seta aponta pra fora — esquerda recolhe à esquerda, direita à direita.
export function CollapseBtn({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Recolher painel"
      className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900/80 text-neutral-500 backdrop-blur transition hover:border-neutral-700 hover:text-neutral-200"
    >
      <Icon name={side === 'left' ? 'chevronLeft' : 'chevronRight'} size={14} />
    </button>
  );
}
