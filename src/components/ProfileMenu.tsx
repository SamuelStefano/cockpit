import { Avatar, Badge, Button, Input, Switch, Tooltip, tokens } from './primitives';
import { connStateColor, connStateLabel, type ConnState } from './primitives/ConnDot';
import { roleBadge } from './chrome/role-badge';
import type { NavRole } from './chrome/nav-routes';
import { AvatarFace } from './avatar/AvatarFace';
import { useProfileMenu } from './avatar/useProfileMenu';
import { ChangePasswordForm } from './profile/ChangePasswordForm';
import { DevicesSection } from './profile/DevicesSection';
import { DropButton } from './drop/DropButton';
import type { DropApi } from '../cockpit/useDrops';
import { usePersisted } from '../lib/persist';
import { SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT, GROUP_NOTES_KEY, GROUP_NOTES_DEFAULT, NOTIFY_SOUND_KEY, NOTIFY_SOUND_DEFAULT } from '../lib/prefs';
import { isIOS } from '../lib/platform';

interface ProfileMenuProps {
  userId?: string;
  onSignOut?: () => void;
  onChangePassword?: (password: string) => Promise<string | null>;
  // Ausente pra quem não é admin: os frames drop-* ficam fora do STUDENT_ALLOWED.
  drops?: DropApi;
  // Shell extras: the connection dot rides on the avatar and the role badge sits in the panel.
  conn?: ConnState;
  role?: NavRole;
  placement?: 'down-end' | 'up-start';
  // 'row' = the sidebar account line (avatar + name), 'rail' = its avatar-only form; 'icon' = the bare round avatar.
  variant?: 'icon' | 'row' | 'rail';
}

const PANEL_PLACEMENT = {
  'down-end': 'right-0 top-full mt-1.5',
  'up-start': 'bottom-full left-0 mb-2 max-h-[80vh] overflow-y-auto',
} as const;

// Menu de perfil no header: define nome (usado nas iniciais do chat), faz
// upload/limpa o avatar e, com conta Supabase, troca a senha. Perfil e toggles
// vão pro cache local e sobem pra conta (ver lib/profile e lib/account-prefs).
export function ProfileMenu({ userId, onSignOut, onChangePassword, drops, conn, role, placement = 'down-end', variant = 'icon' }: ProfileMenuProps = {}) {
  const { name, avatar, setName, setAvatar, synced, syncFailed, open, setOpen, uploadError, uploading, fileRef, wrapRef, onFile } = useProfileMenu(userId);
  const [showTools, setShowTools] = usePersisted<boolean>(SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT);
  const [groupNotes, setGroupNotes] = usePersisted<boolean>(GROUP_NOTES_KEY, GROUP_NOTES_DEFAULT);
  const [notifySound, setNotifySound] = usePersisted<boolean>(NOTIFY_SOUND_KEY, NOTIFY_SOUND_DEFAULT);

  const badge = role ? roleBadge(role) : null;
  return (
    <div ref={wrapRef} className="relative">
      {variant !== 'icon' ? (
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Perfil"
          aria-haspopup="dialog"
          aria-expanded={open}
          title={variant === 'rail' ? name || 'Perfil' : undefined}
          className={`flex h-10 items-center rounded-lg text-left ${variant === 'rail' ? 'w-10 justify-center' : 'w-full min-w-0 gap-2.5 pl-2.5 pr-2'} text-[13px] font-medium text-neutral-200 transition hover:bg-neutral-800/70 pointer-coarse:h-11 ${tokens.focusRing}`}
        >
          <span className="relative flex shrink-0">
            <Avatar name={name} src={avatar || undefined} size={28} />
            {conn && conn !== 'connected' && (
              <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-950 ${conn === 'reconnecting' ? 'animate-pulse' : ''}`} style={{ background: connStateColor(conn) }} />
            )}
          </span>
          {variant === 'row' && <span className="min-w-0 flex-1 truncate">{name || 'Sem nome'}</span>}
        </button>
      ) : (
      <Tooltip label={[name || 'Perfil', conn && connStateLabel(conn), badge?.label].filter(Boolean).join(' · ')} side={placement === 'up-start' ? 'right' : 'bottom'} disabled={open}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Perfil"
        // A panel with a form (name, image, toggles), not a list of commands:
        // announced as a dialog, not as a menu with no menu items.
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 transition hover:border-orange-500/60 pointer-coarse:h-11 pointer-coarse:w-11"
      >
        <AvatarFace avatar={avatar} name={name} size={32} />
        {conn && (
          <span
            aria-hidden="true"
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-950 ${conn === 'reconnecting' ? 'animate-pulse' : ''}`}
            style={{ background: connStateColor(conn) }}
          />
        )}
      </button>
      </Tooltip>
      )}
      {open && (
        <div role="dialog" aria-label="Perfil" className={`fade-up absolute z-50 w-60 max-w-[calc(100vw-1rem)] ${PANEL_PLACEMENT[placement]} rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-2xl`}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-950">
              <AvatarFace avatar={avatar} name={name} size={40} />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-200">
                <span className="truncate">{name || 'Sem nome'}</span>
                {badge && <Badge tone={badge.tone} title={badge.title} className="font-mono">{badge.label}</Badge>}
              </p>
              <p className={`text-[12px] ${synced && syncFailed ? 'text-amber-400' : 'text-neutral-500'}`}>
                {synced ? (syncFailed ? 'Salvo só neste device — não sincronizou' : 'Sincronizado') : 'Perfil local'}
              </p>
            </div>
          </div>
          <label htmlFor="profile-name" className="mt-3 block text-[12px] font-medium text-neutral-500">Nome</label>
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
          {uploadError && <p role="alert" className="mt-1.5 text-[12px] text-red-400">{uploadError}</p>}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

          <div className="mt-3 space-y-1.5 border-t border-neutral-800 pt-3">
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
            <Switch
              checked={notifySound}
              onChange={() => setNotifySound((v) => !v)}
              icon="volume"
              label="Som ao terminar o turno"
              // iOS suspends a backgrounded tab or PWA: the beep and the
              // notification only fire once it is back in front.
              hint={isIOS() ? 'No iPhone/iPad o app em segundo plano fica pausado: o aviso só sai ao voltar' : 'Beep curto, só com a aba fora de foco'}
            />
          </div>

          {onSignOut && <DevicesSection />}

          {drops && <DropButton api={drops} />}

          {onChangePassword && <ChangePasswordForm onSubmit={onChangePassword} />}

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
