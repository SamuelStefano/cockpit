import { Icon } from '../primitives';
import { initials } from '../avatar.initials';

// Face não-interativa do avatar (sem file picker): usada como gatilho do menu de
// perfil no header, onde o clique abre o popover em vez de escolher imagem.
export function AvatarFace({ avatar, name, size }: { avatar: string; name: string; size: number }) {
  const init = initials(name);
  return (
    <span
      className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {avatar ? (
        <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
      ) : init ? (
        <span className="font-semibold text-neutral-200" style={{ fontSize: Math.round(size * 0.4) }}>{init}</span>
      ) : (
        <Icon name="user" size={Math.round(size * 0.5)} />
      )}
    </span>
  );
}
