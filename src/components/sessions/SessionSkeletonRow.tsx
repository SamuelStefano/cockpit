import { Skeleton } from '../primitives';

export function SessionSkeletonRow() {
  return (
    <div className="rounded-xl border border-neutral-800/60 px-3.5 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-10" />
      </div>
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="mt-1.5 h-2.5 w-3/5" />
    </div>
  );
}
