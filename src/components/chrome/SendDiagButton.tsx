import { Button } from '../primitives';
import { useSendDiag, type SendDiagState } from '../../app/diag/useSendDiag';

const LABEL: Record<SendDiagState, string> = {
  idle: 'Enviar diagnóstico ao admin',
  sending: 'Enviando…',
  sent: 'Enviado ao admin',
  failed: 'Não foi possível enviar',
  limited: 'Já enviado há pouco',
};

export function SendDiagButton({ className }: { className?: string }) {
  const { state, trigger } = useSendDiag();
  return (
    <Button
      variant="outline"
      size="xs"
      icon={state === 'sent' ? 'check' : 'send'}
      loading={state === 'sending'}
      disabled={state === 'sending'}
      onClick={() => { void trigger(); }}
      className={className}
      aria-live="polite"
    >
      {LABEL[state]}
    </Button>
  );
}
