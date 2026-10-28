// A tiny broom held low in front of Bit, plus the dust it kicks up (bit-play.css).
export function BitBroom() {
  return (
    <svg viewBox="0 0 60 60" width="60%" height="60%" className="pointer-events-none absolute overflow-visible" style={{ left: '62%', top: '46%' }}>
      <g fill="#d6d3d1">
        <circle className="bit-dust" cx={34} cy={52} r={4} />
        <circle className="bit-dust" cx={40} cy={50} r={3} />
        <circle className="bit-dust" cx={28} cy={53} r={3.5} />
      </g>
      <g className="bit-broom-prop">
        <path d="M14 4l12 36" stroke="#a16207" strokeWidth={3.4} strokeLinecap="round" />
        <path d="M18 38l18-6 8 20-22 6z" fill="#facc15" stroke="#a16207" strokeWidth={2} strokeLinejoin="round" />
        <path d="M27 40l4 13M33 38l5 13" stroke="#a16207" strokeWidth={1.4} opacity={0.6} />
      </g>
    </svg>
  );
}
