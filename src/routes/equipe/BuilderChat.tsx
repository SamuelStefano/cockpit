import type { BuilderTurn } from '../../../shared/agent-builder';
import { Button } from '../../components/primitives';

interface BuilderChatProps {
  turns: BuilderTurn[];
  input: string;
  pending: boolean;
  error: string | null;
  onInput: (v: string) => void;
  onSend: () => void;
}

export function BuilderChat({ turns, input, pending, error, onInput, onSend }: BuilderChatProps) {
  return (
    <div className="flex flex-col gap-2">
      <div role="log" aria-label="Conversa" className="scroll-thin flex max-h-64 min-h-24 flex-col gap-2 overflow-y-auto">
        {turns.map((t, i) => (
          <p key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-relaxed ${t.role === 'user' ? 'self-end bg-orange-500/15 text-neutral-100' : 'self-start bg-neutral-800 text-neutral-200'}`}>{t.text}</p>
        ))}
        {pending && <p className="self-start text-[13px] text-neutral-500" aria-live="polite">Pensando…</p>}
      </div>
      {error && <p role="alert" className="text-[13px] text-red-400">{error}</p>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
        <input aria-label="Sua mensagem" value={input} onChange={(e) => onInput(e.target.value)} placeholder="Escreva aqui…" disabled={pending}
          className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 outline-hidden focus:border-orange-500/40" />
        <Button type="submit" variant="primary" size="md" icon="send" loading={pending} disabled={!input.trim()}>Enviar</Button>
      </form>
    </div>
  );
}
