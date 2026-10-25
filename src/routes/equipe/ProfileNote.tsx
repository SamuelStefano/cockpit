import type { TeamProfile } from '../../../shared/protocol';
import { Badge } from '../../components/primitives';
import { profileCopy } from './profile-copy';

export function ProfileNote({ profile }: { profile: TeamProfile }) {
  const c = profileCopy(profile);
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[12.5px] text-neutral-300">
        Perfil: <Badge tone={c.tone}>{c.badge}</Badge>
      </span>
      <span className="text-[12px] leading-relaxed text-neutral-500">{c.line}</span>
    </div>
  );
}
