import { Icon } from '../primitives';

export function PrimaryStar({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-label="bot principal" title="bot principal"
      className="flex items-center justify-center rounded-full bg-orange-500 text-white ring-2 ring-neutral-950"
      style={{ width: size, height: size }}
    >
      <Icon name="star" size={Math.round(size * 0.6)} />
    </span>
  );
}
