import type { BitState } from './bit-state';

const SPARK = 'M0-7l1.8 5.2 5.2 1.8-5.2 1.8L0 7l-1.8-5.2L-7 0l5.2-1.8z';

export function BitFx({ state }: { state: BitState }) {
  if (state === 'happy') {
    return (
      <g>
        <path className="bit-spark" d={SPARK} transform="translate(12 34) scale(1.3)" fill="#fde68a" />
        <path className="bit-spark" d={SPARK} transform="translate(106 24)" fill="#fde68a" />
        <path className="bit-spark" d={SPARK} transform="translate(110 70) scale(.8)" fill="#fdba74" />
      </g>
    );
  }
  if (state === 'sleeping') {
    return (
      <g fill="#fdba74" fontFamily="ui-monospace, monospace" fontWeight={700}>
        <text className="bit-z" x={74} y={22} fontSize={16}>z</text>
        <text className="bit-z" x={74} y={22} fontSize={12}>z</text>
      </g>
    );
  }
  if (state === 'connecting') {
    return (
      <g fill="none" stroke="#fdba74" strokeWidth={2}>
        <circle className="bit-ring" cx={60} cy={12} r={10} />
        <circle className="bit-ring" cx={60} cy={12} r={10} />
      </g>
    );
  }
  return null;
}
