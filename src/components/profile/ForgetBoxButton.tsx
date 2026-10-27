import { Button } from '../primitives';
import { useArmed } from '../primitives/useArmed';

export function ForgetBoxButton({ onForget }: { onForget: () => void }) {
  const { armed, fire } = useArmed();
  return (
    <div className="mt-2 flex items-center gap-2">
      <p className="min-w-0 grow text-[11px] text-neutral-500">
        Apaga deste navegador a chave desta VPS. Pra recomeçar do zero, crie também uma passkey nova.
      </p>
      <Button variant={armed ? 'danger' : 'ghost'} size="sm" onClick={() => fire(onForget)}>
        {armed ? 'confirmar?' : 'Esquecer esta VPS'}
      </Button>
    </div>
  );
}
