import { Icon } from './primitives';
import { usePersisted } from '../lib/persist';
import { initials } from './avatar.initials';

// Avatar do usuário no chat: SÓ exibe (não troca a imagem ao clicar). A troca de
// avatar vive no menu de perfil do header — clicar na bolha do chat não deve abrir
// seletor de imagem (pedido do Samuel).
export function UserAvatar({ size = 28 }: { size?: number }) {
  const [avatar] = usePersisted<string>('user.avatar', '');
  const [name] = usePersisted<string>('user.name', '');
  const init = initials(name);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300"
      style={{ width: size, height: size }}
    >
      {avatar ? (
        <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
      ) : init ? (
        <span className="font-semibold" style={{ fontSize: Math.round(size * 0.4) }}>{init}</span>
      ) : (
        <Icon name="user" size={Math.round(size * 0.5)} />
      )}
    </span>
  );
}
