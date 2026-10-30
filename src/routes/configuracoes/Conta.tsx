import { Avatar, Badge, Button, Input, ListRow, SectionTitle } from '../../components/primitives';
import { roleBadge } from '../../components/chrome/role-badge';
import type { NavRole } from '../../components/chrome/nav-routes';
import { useProfileMenu } from '../../components/avatar/useProfileMenu';
import { ChangePasswordForm } from '../../components/profile/ChangePasswordForm';
import { DropButton } from '../../components/drop/DropButton';
import type { DropApi } from '../../cockpit/useDrops';
import { usePersisted } from '../../lib/persist';
import { SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT, GROUP_NOTES_KEY, GROUP_NOTES_DEFAULT, NOTIFY_SOUND_KEY, NOTIFY_SOUND_DEFAULT, HAPTICS_KEY, HAPTICS_DEFAULT, GAME_ENABLED_KEY, GAME_ENABLED_DEFAULT, GAME_SOUND_KEY, GAME_SOUND_DEFAULT } from '../../lib/prefs';
import { isIOS, isStandalone } from '../../lib/platform';
import { requestNotifyPermission } from '../../lib/notify';
import { SwitchRow } from './SwitchRow';
import { DevicesSection } from '../../components/profile/DevicesSection';
import { SendDiagButton } from '../../components/chrome/SendDiagButton';
import { SUPABASE_ENABLED } from '../../lib/supabase';

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
  const [haptics, setHaptics] = usePersisted<boolean>(HAPTICS_KEY, HAPTICS_DEFAULT);
  const [gameOn, setGameOn] = usePersisted<boolean>(GAME_ENABLED_KEY, GAME_ENABLED_DEFAULT);
  const [gameSound, setGameSound] = usePersisted<boolean>(GAME_SOUND_KEY, GAME_SOUND_DEFAULT);
  const badge = roleBadge(role);

  return (
    <>
      <SectionTitle className="max-lg:hidden">Conta</SectionTitle>
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
          className="max-sm:flex-wrap"
          trailing={<span className="w-44 shrink-0 max-sm:w-full"><Input id="profile-name" size="sm" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" /></span>}
        />
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <SwitchRow label="Mostrar ferramentas" hint="Bash, Read, Grep… no chat" checked={showTools} onChange={() => setShowTools((v) => !v)} />
        <SwitchRow label="Agrupar notas do agente" hint="Só a resposta final fica solta" checked={groupNotes} onChange={() => setGroupNotes((v) => !v)} />
        <SwitchRow
          label="Som ao terminar o turno"
          hint={isIOS() ? (isStandalone() ? 'No iPhone/iPad o app em segundo plano fica pausado: o aviso só sai ao voltar' : 'Avisos no iPhone: instale o Deck na tela inicial (Compartilhar › Adicionar à Tela de Início)') : 'Beep curto, só com a aba fora de foco'}
          checked={notifySound} onChange={() => { if (!notifySound) requestNotifyPermission(); setNotifySound((v) => !v); }}
        />
        <SwitchRow label="Vibração no toque" hint="Enviar, fim do turno e segurar uma mensagem (Android; o Safari do iPhone não vibra)" checked={haptics} onChange={() => setHaptics((v) => !v)} />
        <SwitchRow label="Arcade" hint="Nível, missões, conquistas e segredos. Desligado, some tudo e nada é registrado" checked={gameOn} onChange={() => setGameOn((v) => !v)} />
        {gameOn && <SwitchRow label="Sons do Arcade" hint="Efeitos de 8 bits em conquistas, level up e no Bit Runner" checked={gameSound} onChange={() => setGameSound((v) => !v)} />}
        {account.drops && (
          <ListRow label="Drop privado" hint="Entrega segredo ou script ao agente sem passar pelo chat" trailing={<DropButton api={account.drops} bare />} />
        )}
        {account.onChangePassword && (
          <div className="border-t border-neutral-800 px-4 py-3"><ChangePasswordForm onSubmit={account.onChangePassword} bare /></div>
        )}
        {account.onSignOut && <div className="border-t border-neutral-800 px-4 pb-3"><DevicesSection /></div>}
        {SUPABASE_ENABLED && (
          <ListRow label="Diagnóstico" hint="Manda o log da conexão pro admin" trailing={<SendDiagButton />} />
        )}
        {account.onSignOut && (
          <ListRow label="Sair desta conta" trailing={<Button variant="danger" size="sm" icon="x" onClick={account.onSignOut}>Desconectar conta</Button>} />
        )}
      </div>
    </>
  );
}
