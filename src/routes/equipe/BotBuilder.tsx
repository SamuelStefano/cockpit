import { draftIsEmpty, type BuilderDraft } from '../../../shared/agent-builder';
import { Button, Modal } from '../../components/primitives';
import { BuilderChat } from './BuilderChat';
import { BuilderPreview } from './BuilderPreview';
import { useBotBuilder, type BuilderDeps } from './useBotBuilder';

interface BotBuilderProps extends BuilderDeps {
  onAccept: (draft: BuilderDraft) => void;
  onClose: () => void;
}

export function BotBuilder({ onAccept, onClose, ...deps }: BotBuilderProps) {
  const b = useBotBuilder(deps);
  const editing = deps.initial.name !== '';
  const usable = !draftIsEmpty(b.draft) && b.draft.name !== '';
  return (
    <Modal open onClose={onClose} title={editing ? 'Ajustar conversando' : 'Criar agente conversando'} icon="message" maxWidth="max-w-xl"
      footer={(
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" icon="check" disabled={!usable} onClick={() => onAccept(b.draft)}>Aceitar prévia</Button>
        </div>
      )}>
      <div className="flex flex-col gap-3">
        <BuilderChat turns={b.turns} input={b.input} pending={b.pending} error={b.error} onInput={b.setInput} onSend={b.send} />
        <BuilderPreview draft={b.draft} skills={deps.skills} onToggle={b.toggle} />
      </div>
    </Modal>
  );
}
