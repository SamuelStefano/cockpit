import { Button, Input, Switch } from './primitives';
import { AvatarFace } from './avatar/AvatarFace';
import { AiIconPicker } from './avatar/AiIconPicker';
import { useProfileMenu } from './avatar/useProfileMenu';
import { usePersisted } from '../lib/persist';
import { SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT, GROUP_NOTES_KEY, GROUP_NOTES_DEFAULT } from '../lib/prefs';

// Menu de perfil no header: define nome (usado nas iniciais do chat) e faz
// upload/limpa o avatar. Tudo local (data URL no localStorage), sem backend.
export function ProfileMenu({ userId, onSignOut }: { userId?: string; onSignOut?: () => void } = {}) {
  const { name, avatar, aiIcon, setName, setAvatar, setAiIcon, synced, syncFailed, open, setOpen, iconOpen, setIconOpen, uploadError, uploading, fileRef, wrapRef, onFile } = useProfileMenu(userId);
  const [showTools, setShowTools] = usePersisted<boolean>(SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT);
  const [groupNotes, setGroupNotes] = usePersisted<boolean>(GROUP_NOTES_KEY, GROUP_NOTES_DEFAULT);

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
        <div className="fade-up absolute right-0 top-full z-50 mt-1.5 w-60 max-w-[calc(100vw-1rem)] rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-950">
              <AvatarFace avatar={avatar} name={name} size={40} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-neutral-200">{name || 'Sem nome'}</p>
              <p className={`text-[11px] ${synced && syncFailed ? 'text-amber-400' : 'text-neutral-500'}`}>
                {synced ? (syncFailed ? 'Salvo só neste device — não sincronizou' : 'Sincronizado') : 'Perfil local'}
              </p>
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
            <Button variant="outline" size="sm" icon="paperclip" className="grow" loading={uploading} onClick={() => fileRef.current?.click()}>
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

          <div className="mt-3 space-y-1.5">
            <Switch
              checked={showTools}
              onChange={() => setShowTools((v) => !v)}
              icon="terminal"
              label="Mostrar ferramentas"
              hint="Bash, Read, Grep… no chat"
            />
            <Switch
              checked={groupNotes}
              onChange={() => setGroupNotes((v) => !v)}
              icon="sparkles"
              label="Agrupar notas do agente"
              hint="Só a resposta final fica solta"
            />
          </div>

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
