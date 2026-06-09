import { Icon } from './primitives';
import { usePersisted } from '../lib/persist';
import { AI_AVATAR_KEY, AI_AVATAR_DEFAULT, findAiAvatar } from './aiAvatar';

// Avatar do Claude no chat: configurável (burst laranja da marca por padrão, ou um
// emoji escolhido no menu de perfil). Salvo no localStorage, sem backend.
export function ClaudeAvatar({ size = 28 }: { size?: number }) {
  const [id] = usePersisted<string>(AI_AVATAR_KEY, AI_AVATAR_DEFAULT);
  const preset = findAiAvatar(id);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-neutral-950 shadow-sm shadow-orange-500/25"
      style={{ width: size, height: size, background: preset.bg }}
    >
      {preset.emoji ? (
        <span style={{ fontSize: Math.round(size * 0.56), lineHeight: 1 }}>{preset.emoji}</span>
      ) : (
        <Icon name="claude" size={Math.round(size * 0.52)} stroke={2.2} />
      )}
    </div>
  );
}
