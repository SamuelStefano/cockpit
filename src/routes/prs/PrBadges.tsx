import { Badge } from '../../components/primitives/Badge';
import type { PrSummary } from '../../../shared/prs';
import { prBadges } from './prs-view';

export function PrBadges({ pr }: { pr: PrSummary }) {
  return (
    <>
      {prBadges(pr).map((b) => <Badge key={b.label} tone={b.tone}>{b.label}</Badge>)}
    </>
  );
}
