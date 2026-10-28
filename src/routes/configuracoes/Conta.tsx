import { Avatar, Badge, Button, Input, ListRow, SectionTitle } from '../../components/primitives';
import { roleBadge } from '../../components/chrome/role-badge';
import type { NavRole } from '../../components/chrome/nav-routes';
import { useProfileMenu } from '../../components/avatar/useProfileMenu';
import { ChangePasswordForm } from '../../components/profile/ChangePasswordForm';
import { DropButton } from '../../components/drop/DropButton';
import type { DropApi } from '../../cockpit/useDrops';
import { usePersisted } from '../../lib/persist';
import { SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT, GROUP_NOTES_KEY, GROUP_NOTES_DEFAULT, NOTIFY_SOUND_KEY, NOTIFY_SOUND_DEFAULT } from '../../lib/prefs';
import { isIOS } from '../../lib/platform';
import { SwitchRow } from './SwitchRow';

export interface AccountProps {
  userId?: string;
  onSignOut?: () => void;
  onChangePassword?: (password: string) => Promise<string | null>;
  drops?: DropApi;
}

export function Conta({ account, role }: { account: AccountProps; role: NavRole }) {
  const { name, avatar, setName, setAvatar, synced, syncFailed, uploadError, uploading, fileRef, onFile } = useProfileMenu(account.userId);
  const [showTools, setShowTools] = usePersisted<boolean>(SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT);
  const [groupNotes, setGroupNotes] = usePersisted<boolean>(GROUP_NOTES_KEY, GROUP_NOTES_DEFAULT);
  const [notifySound, setNotifySound] = usePersisted<boolean>(NOTIFY_SOUND_KEY, NOTIFY_SOUND_DEFAULT);
  const badge = roleBadge(role);

  return (
    <>
      <SectionTitle>Conta</SectionTitle>
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 hairline">
        <ListRow
          leading={<Avatar name={name} src={avatar || undefined} size={36} />}
          label={<span className="flex items-center gap-1.5"><span className="truncate">{name || 'Sem nome'}</span>{badge && <Badge tone={badge.tone} title={badge.title} className="font-mono">{badge.label}</Badge>}</span>}
          hint={<span className={synced && syncFailed ? 'text-amber-400' : undefined}>{synced ? (syncFailed ? 'Salvo só neste device — não sincronizou' : 'Sincronizado') : 'Perfil local'}</span>}
          trailing={
            <span className="flex gap-2">
              <Button variant="ghost" size="sm" icon="paperclip" loading={uploading} onClick={() => fileRef.current?.click()}>Trocar imagem</Button>
              {avatar && <Button variant="danger" size="sm" onClick={() => setAvatar('')}>Limpar</Button>}
            </span>
          }
        />
        <ListRow
          label={<label htmlFor="profile-name">Nome</label>}
          hint={uploadError ? <span role="alert" className="text-red-400">{uploadError}</span> : 'Aparece nas iniciais do chat'}
          trailing={<Input id="profile-name" size="sm" className="w-44" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />}
        />
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <SwitchRow label="Mostrar ferramentas" hint="Bash, Read, Grep… no chat" checked={showTools} onChange={() => setShowTools((v) => !v)} />
        <SwitchRow label="Agrupar notas do agente" hint="Só a resposta final fica solta" checked={groupNotes} onChange={() => setGroupNotes((v) => !v)} />
        <SwitchRow
          label="Som ao terminar o turno"
          hint={isIOS() ? 'No iPhone/iPad o app em segundo plano fica pausado: o aviso só sai ao voltar' : 'Beep curto, só com a aba fora de foco'}
          checked={notifySound} onChange={() => setNotifySound((v) => !v)}
        />
        {account.drops && (
          <ListRow label="Drop privado" hint="Entrega segredo ou script ao agente sem passar pelo chat" trailing={<DropButton api={account.drops} bare />} />
        )}
        {account.onChangePassword && (
          <div className="border-t border-neutral-800 px-4 py-3"><ChangePasswordForm onSubmit={account.onChangePassword} bare /></div>
        )}
        {account.onSignOut && (
          <ListRow label="Sair desta conta" trailing={<Button variant="danger" size="sm" icon="x" onClick={account.onSignOut}>Desconectar conta</Button>} />
        )}
      </div>
    </>
  );
}
