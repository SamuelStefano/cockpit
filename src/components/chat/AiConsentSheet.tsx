import { Button, Modal } from '../primitives';

// First-send disclosure in the store build: prompts leave the user's server for an AI provider.
export function AiConsentSheet({ open, onAgree, onDecline }: { open: boolean; onAgree: () => void; onDecline: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onDecline}
      title="Antes de enviar"
      icon="shield"
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onDecline}>Agora não</Button>
          <Button variant="primary" size="sm" onClick={onAgree}>Concordo</Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-neutral-300">
        O agente no seu servidor envia seus prompts ao provedor de IA que ele usa. O que você escreve aqui, e o contexto que o agente reunir, sai do seu servidor para esse provedor.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-500">
        Detalhes na <a href="/privacy/" target="_blank" rel="noopener noreferrer" className="text-orange-300 underline underline-offset-2">política de privacidade</a>.
      </p>
    </Modal>
  );
}
