import { Icon } from './primitives';
import { AvatarFace } from './avatar/AvatarFace';
import { AiIconPicker } from './avatar/AiIconPicker';
import { useProfileMenu } from './avatar/useProfileMenu';

// Menu de perfil no header: define nome (usado nas iniciais do chat) e faz
// upload/limpa o avatar. Tudo local (data URL no localStorage), sem backend.
export function ProfileMenu({ userId, onSignOut }: { userId?: string; onSignOut?: () => void } = {}) {
  const { name, avatar, aiIcon, setName, setAvatar, setAiIcon, synced, open, setOpen, iconOpen, setIconOpen, fileRef, wrapRef, onFile } = useProfileMenu(userId);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Perfil"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 transition hover:border-orange-500/60"
      >
        <AvatarFace avatar={avatar} name={name} size={32} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-950">
              <AvatarFace avatar={avatar} name={name} size={40} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-neutral-200">{name || 'Sem nome'}</p>
              <p className="text-[11px] text-neutral-500">{synced ? 'Sincronizado' : 'Perfil local'}</p>
            </div>
          </div>
          <label className="mt-3 block text-[11px] font-medium text-neutral-500">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[12.5px] text-neutral-200 outline-none transition focus:border-orange-500/40"
          />
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[12px] text-neutral-300 transition hover:border-neutral-700"
            >
              <Icon name="paperclip" size={12} /> Trocar imagem
            </button>
            {avatar && (
              <button
                onClick={() => setAvatar('')}
                className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[12px] text-neutral-400 transition hover:border-red-500/40 hover:text-red-300"
              >
                Limpar
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

          <AiIconPicker open={iconOpen} onToggle={() => setIconOpen((o) => !o)} selected={aiIcon} onSelect={setAiIcon} />

          {onSignOut && (
            <div className="mt-3 border-t border-neutral-800 pt-3">
              <button
                onClick={() => { setOpen(false); onSignOut(); }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[12px] text-neutral-300 transition hover:border-red-500/40 hover:text-red-300"
              >
                <Icon name="x" size={12} /> Desconectar conta
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
