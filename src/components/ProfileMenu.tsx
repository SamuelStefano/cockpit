import { Button, Icon, Input, tokens } from './primitives';
import { AvatarFace } from './avatar/AvatarFace';
import { AiIconPicker } from './avatar/AiIconPicker';
import { useProfileMenu } from './avatar/useProfileMenu';
import { usePersisted } from '../lib/persist';
import { SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT } from '../lib/prefs';

// Menu de perfil no header: define nome (usado nas iniciais do chat) e faz
// upload/limpa o avatar. Tudo local (data URL no localStorage), sem backend.
export function ProfileMenu({ userId, onSignOut }: { userId?: string; onSignOut?: () => void } = {}) {
  const { name, avatar, aiIcon, setName, setAvatar, setAiIcon, synced, open, setOpen, iconOpen, setIconOpen, uploadError, fileRef, wrapRef, onFile } = useProfileMenu(userId);
  const [showTools, setShowTools] = usePersisted<boolean>(SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT);

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
        <div className="absolute right-0 top-full z-50 mt-1.5 w-60 max-w-[calc(100vw-1rem)] rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-950">
              <AvatarFace avatar={avatar} name={name} size={40} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-neutral-200">{name || 'Sem nome'}</p>
              <p className="text-[11px] text-neutral-500">{synced ? 'Sincronizado' : 'Perfil local'}</p>
            </div>
          </div>
          <label htmlFor="profile-name" className="mt-3 block text-[11px] font-medium text-neutral-500">Nome</label>
          <Input
            id="profile-name"
            size="sm"
            className="mt-1"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
          <div className="mt-2.5 flex gap-2">
            <Button variant="outline" size="sm" icon="paperclip" className="grow" onClick={() => fileRef.current?.click()}>
              Trocar imagem
            </Button>
            {avatar && (
              <Button variant="danger" size="sm" onClick={() => setAvatar('')}>
                Limpar
              </Button>
            )}
          </div>
          {uploadError && <p role="alert" className="mt-1.5 text-[11px] text-red-400">{uploadError}</p>}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

          <AiIconPicker open={iconOpen} onToggle={() => setIconOpen((o) => !o)} selected={aiIcon} onSelect={setAiIcon} />

          <button
            role="switch"
            aria-checked={showTools}
            onClick={() => setShowTools((v) => !v)}
            className={`mt-3 flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-left transition hover:border-neutral-700 ${tokens.focusRing}`}
          >
            <Icon name="terminal" size={13} className="shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] text-neutral-200">Mostrar ferramentas</span>
              <span className="block text-[10.5px] text-neutral-500">Bash, Read, Grep… no chat</span>
            </span>
            <span className={`relative h-4 w-7 shrink-0 rounded-full transition ${showTools ? 'bg-orange-500/80' : 'bg-neutral-700'}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${showTools ? 'left-3.5' : 'left-0.5'}`} />
            </span>
          </button>

          {onSignOut && (
            <div className="mt-3 border-t border-neutral-800 pt-3">
              <Button variant="danger" size="sm" icon="x" className="w-full" onClick={() => { setOpen(false); onSignOut?.(); }}>
                Desconectar conta
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
