import { Button } from '../primitives';
import { useQrLoginRequest } from './useQrLoginRequest';

const MESSAGE: Record<string, string> = {
  loading: 'gerando código…',
  signing: 'Aprovado. Entrando…',
  expired: 'Este código expirou.',
  unavailable: 'Entrar com QR não está disponível agora. Use e-mail e senha.',
  failed: 'Não deu para entrar com este código. Gere outro.',
};

export function QrLoginPanel({ onBack }: { onBack: () => void }) {
  const q = useQrLoginRequest(true);
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[13px] leading-relaxed text-neutral-400">
        No celular onde o Deck já está aberto, aponte a câmera para o código e aprove o acesso.
      </p>
      {q.qr && <img src={q.qr} alt="QR para entrar no Deck" className="h-56 w-56 rounded-lg bg-white" />}
      {q.phase === 'waiting' && <p className="text-[12px] text-neutral-500">expira em {q.countdown}</p>}
      {MESSAGE[q.phase] && <p className="py-2 text-center text-[12.5px] text-neutral-400">{MESSAGE[q.phase]}</p>}
      {(q.phase === 'expired' || q.phase === 'failed') && (
        <Button type="button" variant="primary" size="sm" icon="rotate" onClick={q.again}>Gerar outro</Button>
      )}
      <Button type="button" variant="ghost" size="sm" icon="chevronLeft" className="w-full" onClick={onBack}>
        Entrar com e-mail e senha
      </Button>
    </div>
  );
}
