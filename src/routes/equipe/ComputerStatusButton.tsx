import { Button } from '../../components/primitives';

interface ComputerStatusButtonProps {
  active: boolean;
  pressed: boolean;
  onClick: () => void;
}

export function ComputerStatusButton({ active, pressed, onClick }: ComputerStatusButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      square
      icon="monitor"
      aria-label={active ? 'Computador ativo' : 'Computador'}
      aria-pressed={pressed}
      title={active ? 'Computador ativo — acompanhar sem sair da conversa' : 'Ver o computador do bot'}
      className={active ? 'text-violet-400' : 'text-neutral-500'}
      onClick={onClick}
    />
  );
}
