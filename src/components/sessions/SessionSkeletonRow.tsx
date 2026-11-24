import { Skeleton } from '../primitives';

export function SessionSkeletonRow() {
  return (
    <div className="flex h-9.5 items-center px-2.5">
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
