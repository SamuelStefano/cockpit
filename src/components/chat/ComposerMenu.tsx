import { useMenuKeys } from '../primitives/useMenuKeys';
import { Icon, tokens, type IconName } from '../primitives';
import { ComposerSettings, type ComposerSettingsProps } from './ComposerSettings';
import type { Mic } from './mic-types';

const item = `flex w-full items-center gap-2.5 px-3 py-2.5 pointer-coarse:min-h-11 text-left text-[13px] text-neutral-200 transition hover:bg-neutral-800/60 ${tokens.focusRing}`;

interface ComposerMenuProps {
  touch: boolean;
  mic: Mic;
  onAttach: () => void;
  onPhoto: () => void;
  onCall?: () => void;
  run: (fn: () => void) => void;
  settings: ComposerSettingsProps;
}

function Item({ icon, run, onClick, children }: { icon: IconName; run: ComposerMenuProps['run']; onClick: () => void; children: string }) {
  return (
    <button type="button" role="menuitem" tabIndex={-1} className={item} onClick={() => run(onClick)}>
      <Icon name={icon} size={14} className="text-neutral-500" /> {children}
    </button>
  );
}

// Mounted only while open, so useMenuKeys focuses the first item on mount.
export function ComposerMenu({ touch, mic, onAttach, onPhoto, onCall, run, settings }: ComposerMenuProps) {
  const menu = useMenuKeys<HTMLDivElement>(true);
  return (
    <>
      <div ref={menu.ref} onKeyDown={menu.onKeyDown} role="menu" aria-label="Ações do composer" className="py-1">
        {onCall && <Item icon="phone" run={run} onClick={onCall}>Ligar por voz</Item>}
        <Item icon="paperclip" run={run} onClick={onAttach}>Anexar arquivo</Item>
        {touch && <Item icon="camera" run={run} onClick={onPhoto}>Tirar foto</Item>}
        {touch && mic.supported && <Item icon="mic" run={run} onClick={mic.toggle}>{mic.listening ? 'Parar de ditar' : 'Ditar'}</Item>}
      </div>
      <ComposerSettings {...settings} />
    </>
  );
}
