import { IconButton, Popover } from '../primitives';
import { ComposerMenu } from './ComposerMenu';
import { ComposerSheet } from './ComposerSheet';
import { useComposerPlus } from './useComposerPlus';
import type { ComposerSettingsProps } from './ComposerSettings';
import type { Mic } from './mic-types';

// The one control on the left of the box. Everything that is not "write and send"
// lives behind it: attach, photo, dictation, call and the per-prompt settings.
export function ComposerPlus({ touch, mic, onAttach, onPhoto, onCall, settings }: {
  touch: boolean;
  mic: Mic;
  onAttach: () => void;
  onPhoto: () => void;
  onCall?: () => void;
  settings: ComposerSettingsProps;
}) {
  const { open, toggle, closeAndRefocus, run, wrapRef, sheet } = useComposerPlus();
  const menu = <ComposerMenu touch={touch} mic={mic} onAttach={onAttach} onPhoto={onPhoto} onCall={onCall} run={run} settings={settings} />;
  const trigger = (
    <IconButton
      icon="plus" label="Mais opções do composer" tip="Anexar, ligar e ajustar o próximo prompt"
      aria-expanded={open} aria-haspopup="dialog" onClick={toggle}
      className="mb-0.5 rounded-full"
    />
  );
  return (
    <span ref={wrapRef} className="inline-flex shrink-0">
      {sheet ? (
        <>
          {trigger}
          {open && <ComposerSheet onClose={closeAndRefocus}>{menu}</ComposerSheet>}
        </>
      ) : (
        <Popover open={open} onClose={closeAndRefocus} side="top" align="start" label="Ajustes do próximo prompt" className="w-72 overflow-visible!" content={menu}>
          {trigger}
        </Popover>
      )}
    </span>
  );
}
