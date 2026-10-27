import { IconButton, Sheet } from '../primitives';
import { ComposerMenu } from './ComposerMenu';
import { useComposerPlus } from './useComposerPlus';
import type { ComposerSettingsProps } from './ComposerSettings';
import type { Mic } from './mic-types';

export function ComposerPlus({ touch, mic, onAttach, onPhoto, onCall, settings }: {
  touch: boolean;
  mic: Mic;
  onAttach: () => void;
  onPhoto: () => void;
  onCall?: () => void;
  settings: ComposerSettingsProps;
}) {
  const { open, toggle, closeAndRefocus, run, wrapRef } = useComposerPlus();
  const menu = <ComposerMenu touch={touch} mic={mic} onAttach={onAttach} onPhoto={onPhoto} onCall={onCall} run={run} settings={settings} />;
  return (
    <span ref={wrapRef} className="inline-flex shrink-0">
      <Sheet open={open} onClose={closeAndRefocus} side="top" align="start" label="Ajustes do próximo prompt" className="w-72 overflow-visible!" content={menu}>
        <IconButton
          icon="plus" label="Mais opções do composer" tip="Anexar, ligar e ajustar o próximo prompt"
          aria-expanded={open} aria-haspopup="dialog" onClick={toggle}
          className={`mb-0.5 rounded-full ${open ? 'bg-neutral-800 text-neutral-100' : ''}`}
        />
      </Sheet>
    </span>
  );
}
