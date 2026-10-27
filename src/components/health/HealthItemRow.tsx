import type { HealthItem } from '../../../shared/box-health';
import { LevelIcon } from './LevelIcon';
import { HealthHint } from './HealthHint';

export function HealthItemRow({ item }: { item: HealthItem }) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <LevelIcon state={item.level} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-neutral-200">
          {item.label} <span className="text-neutral-500">· {item.detail}</span>
        </p>
        {item.hint && item.level !== 'ok' && <HealthHint text={item.hint} />}
      </div>
    </li>
  );
}
