import { Icon } from '../primitives';
import type { Route } from '../../useRoute';

interface VilaButtonProps {
  route: Route;
  isAdmin: boolean;
  onGo: (to: Route) => void;
}

export function VilaButton({ route, isAdmin, onGo }: VilaButtonProps) {
  if (!isAdmin) return null;
  const active = route === '/equipe/mundo';
  return (
    <button
      type="button" onClick={() => onGo('/equipe/mundo')} title="Vila" aria-label="Vila" aria-current={active ? 'page' : undefined}
      className={`flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] hover:bg-neutral-800/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 pointer-coarse:h-11 ${active ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-300'}`}
    >
      <Icon name="globe" size={16} />
      <span className="max-md:hidden">Vila</span>
    </button>
  );
}
