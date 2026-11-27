import { Button } from '../primitives';
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
    <Button
      variant="ghost" size="xs" icon="globe" onClick={() => onGo('/equipe/mundo')} title="Vila" aria-label="Vila" aria-current={active ? 'page' : undefined}
      className={`pointer-coarse:h-11 ${active ? 'bg-neutral-800 text-neutral-100' : ''}`}
    >
      <span className="max-md:hidden">Vila</span>
    </Button>
  );
}
