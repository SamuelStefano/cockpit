import { EmptyState } from '../../components/primitives';
import { BaseStage } from './BaseStage';
import { BaseProgress } from './hud/BaseProgress';
import { useDesktopWidth } from './useDesktopWidth';
import type { LiveSource } from './useLiveFeed';

export function Base({ source }: { source: LiveSource }) {
  const desktop = useDesktopWidth();
  if (!desktop) {
    return (
      <EmptyState icon="monitor" title="Desktop only" description="Agent Base needs a screen at least 1100px wide. Your progress is here.">
        <BaseProgress />
      </EmptyState>
    );
  }
  return <BaseStage source={source} />;
}
