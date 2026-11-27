import { PageTitle } from '../../components/primitives';
import type { NavRole } from '../../components/chrome/nav-routes';
import { ExploreCard } from './ExploreCard';
import { exploreItemsFor } from './explore-items';

interface ExplorarProps {
  role: NavRole;
  onOpen: (path: string) => void;
}

export function Explorar({ role, onOpen }: ExplorarProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-8">
        <div className="flex flex-col gap-2">
          <PageTitle icon="compass">Explorar</PageTitle>
          <p className="text-[14px] text-neutral-500">O que não é o dia a dia mora aqui.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {exploreItemsFor(role).map((item) => <ExploreCard key={item.id} item={item} onOpen={onOpen} />)}
        </div>
      </div>
    </div>
  );
}
