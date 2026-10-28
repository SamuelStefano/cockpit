import type { BotView } from './team-view';
import { buildOrgTree, type OrgBranch } from './org-tree';
import { OrgNode } from './OrgNode';

interface OrgTreeProps {
  views: BotView[];
  onOpen: (id: string) => void;
}

const LINE = 'bg-neutral-700';

function Level({ items, onOpen }: { items: OrgBranch[]; onOpen: (id: string) => void }) {
  return (
    <ul className="flex flex-col items-center gap-[22px] md:flex-row md:items-start md:gap-4">
      {items.map((b, i) => {
        const first = i === 0;
        const last = i === items.length - 1;
        return (
          <li key={b.view.bot.id} className="relative flex flex-col items-center md:pt-[22px]">
            {items.length > 1 && (
              <>
                <span aria-hidden className={`absolute left-1/2 top-0 hidden h-[22px] w-px md:block ${LINE}`} />
                <span aria-hidden className={`absolute top-0 hidden h-px md:block ${LINE} ${first ? 'left-1/2 right-[-8px]' : last ? 'left-[-8px] right-1/2' : 'left-[-8px] right-[-8px]'}`} />
              </>
            )}
            <Branch branch={b} onOpen={onOpen} />
          </li>
        );
      })}
    </ul>
  );
}

function Branch({ branch, onOpen }: { branch: OrgBranch; onOpen: (id: string) => void }) {
  return (
    <div className="flex flex-col items-center">
      <OrgNode view={branch.view} onOpen={onOpen} />
      {branch.children.length > 0 && (
        <>
          <span aria-hidden className={`hidden h-[22px] w-px md:block ${LINE}`} />
          <div className="mt-[22px] md:mt-0"><Level items={branch.children} onOpen={onOpen} /></div>
        </>
      )}
    </div>
  );
}

export function OrgTree({ views, onOpen }: OrgTreeProps) {
  const tree = buildOrgTree(views);
  if (tree.length === 0) return null;
  return (
    <div aria-label="Organograma da equipe" className="flex justify-center overflow-x-auto pb-2">
      <Level items={tree} onOpen={onOpen} />
    </div>
  );
}
