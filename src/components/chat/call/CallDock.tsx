import { Button, Icon, tokens } from '../../primitives';
import type { Message } from '../../../data/types';
import type { Phase } from '../useChatPanel';
import { CALL_LABEL } from './call-machine';
import { ComposerNotice } from '../ComposerNotice';
import { useCall } from './useCall';

interface Props {
  messages: Message[];
  phase: Phase;
  onSend: (text: string) => void;
  keyboardOpen: boolean;
}

const DOT: Record<keyof typeof CALL_LABEL, string> = {
  listening: 'bg-emerald-400 animate-pulse',
  thinking: 'bg-amber-400 animate-pulse',
  speaking: 'bg-orange-400 animate-pulse',
};

export function CallDock({ messages, phase, onSend, keyboardOpen }: Props) {
  const call = useCall({ messages, phase, onSend });
  if (!call.supported) return null;
  const { state } = call;

  if (state.phase === 'off') {
    if (keyboardOpen && !call.error) return null;
    return (
      <div className="shrink-0 border-t border-neutral-800 bg-neutral-900/60 px-3 pt-2">
        {call.error && <ComposerNotice icon="mic" onDismiss={call.dismissError}>{call.error}</ComposerNotice>}
        <Button variant="outline" icon="mic" onClick={call.dial} className="h-11! w-full" title="Conversar por voz com a sessão, sem as mãos">
          Ligar
        </Button>
      </div>
    );
  }

  const label = state.muted ? 'Mudo' : CALL_LABEL[state.phase];
  return (
    <div role="region" aria-label="Chamada de voz" className="shrink-0 border-t border-orange-500/30 bg-neutral-900/80 px-3 py-3">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <span className={`h-3 w-3 shrink-0 rounded-full ${state.muted ? 'bg-neutral-600' : DOT[state.phase]}`} />
        <div className="min-w-0 flex-1" aria-live="polite">
          <div className="text-[14px] font-medium text-neutral-100">{label}</div>
          <div className="truncate text-[13px] text-neutral-500">
            {call.heard || (state.phase === 'speaking' ? 'Fale pra interromper' : state.muted ? 'Microfone desligado' : 'Fale quando quiser')}
          </div>
        </div>
        {state.phase === 'speaking' && (
          <Button variant="secondary" square icon="square" onClick={call.interrupt} className="h-12! w-12!" title="Parar de falar" aria-label="Parar de falar" />
        )}
        <button
          type="button"
          onClick={call.toggleMute}
          aria-pressed={state.muted}
          aria-label={state.muted ? 'Ligar microfone' : 'Silenciar microfone'}
          title={state.muted ? 'Ligar microfone' : 'Silenciar microfone'}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${tokens.focusRing} ${state.muted ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
        >
          <Icon name="mic" size={20} />
        </button>
        <Button variant="dangerSolid" square icon="x" onClick={call.hangup} className="h-12! w-12! rounded-full!" title="Desligar" aria-label="Desligar" />
      </div>
    </div>
  );
}
