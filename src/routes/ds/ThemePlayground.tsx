import { useEffect, useState } from 'react';
import { Button } from '../../components/primitives';

const DEFAULTS = { hue: 24, sat: 90, radius: 12, density: 2 };
const DENSITY = [
  { label: 'compacto', pad: '8px 12px', gap: 8 },
  { label: 'confortável', pad: '11px 16px', gap: 12 },
  { label: 'amplo', pad: '15px 22px', gap: 18 },
];

function Slider({ label, value, min, max, onChange, suffix }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[12px] text-neutral-400">
        {label}<span className="tabular-nums text-neutral-500">{value}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-800 accent-orange-500" />
    </label>
  );
}

// Reescreve os tokens CSS de acento em runtime (:root) e mostra uma amostra viva.
// Restaura os valores originais ao desmontar — o tema só muda enquanto você mexe.
export function ThemePlayground() {
  const [hue, setHue] = useState(DEFAULTS.hue);
  const [sat, setSat] = useState(DEFAULTS.sat);
  const [radius, setRadius] = useState(DEFAULTS.radius);
  const [density, setDensity] = useState(DEFAULTS.density);
  const accent = `hsl(${hue} ${sat}% 55%)`;
  const accentSoft = `hsl(${hue} ${sat}% 62%)`;

  useEffect(() => {
    const root = document.documentElement;
    const prev = { a: root.style.getPropertyValue('--accent'), s: root.style.getPropertyValue('--accent-soft'), r: root.style.getPropertyValue('--ring') };
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-soft', accentSoft);
    root.style.setProperty('--ring', `hsla(${hue} ${sat}% 55% / 0.45)`);
    return () => {
      root.style.setProperty('--accent', prev.a);
      root.style.setProperty('--accent-soft', prev.s);
      root.style.setProperty('--ring', prev.r);
    };
  }, [accent, accentSoft, hue, sat]);

  const d = DENSITY[density];
  const reset = () => { setHue(DEFAULTS.hue); setSat(DEFAULTS.sat); setRadius(DEFAULTS.radius); setDensity(DEFAULTS.density); };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3.5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <Slider label="Matiz do acento" value={hue} min={0} max={360} onChange={setHue} suffix="°" />
        <Slider label="Saturação" value={sat} min={20} max={100} onChange={setSat} suffix="%" />
        <Slider label="Raio das bordas" value={radius} min={0} max={22} onChange={setRadius} suffix="px" />
        <div>
          <span className="mb-1.5 block text-[12px] text-neutral-400">Densidade</span>
          <div className="flex gap-1.5">
            {DENSITY.map((opt, i) => (
              <button key={opt.label} onClick={() => setDensity(i)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-[11.5px] transition ${density === i ? 'border-orange-500/50 bg-orange-500/10 text-orange-200' : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="secondary" size="sm" icon="rotate" onClick={reset} className="mt-1 self-start">restaurar padrão</Button>
      </div>

      <div className="flex flex-col justify-center gap-3 rounded-xl border border-neutral-800 p-4" style={{ gap: d.gap }}>
        <div style={{ borderRadius: radius, background: accent, color: '#0a0a0a', padding: d.pad, fontWeight: 600, boxShadow: `0 8px 24px -8px ${accent}` }}>
          Botão primário
        </div>
        <div style={{ borderRadius: radius, border: `1px solid ${accent}`, color: accentSoft, padding: d.pad, fontWeight: 500 }}>
          Botão contornado
        </div>
        <div style={{ borderRadius: radius, background: '#0f0f12', border: '1px solid #26262b', padding: d.pad }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: accent, boxShadow: `0 0 8px ${accent}` }} />
            <span style={{ color: '#e5e5e5', fontSize: 13 }}>Superfície com acento</span>
            <span style={{ marginLeft: 'auto', borderRadius: radius / 2, background: `${accent}22`, color: accentSoft, fontSize: 11, padding: '2px 8px' }}>badge</span>
          </div>
        </div>
        <input placeholder="campo com foco no acento" style={{ borderRadius: radius, background: '#0a0a0c', border: `1px solid ${accent}55`, color: '#e5e5e5', padding: d.pad, outline: 'none', fontSize: 13 }} />
      </div>
    </div>
  );
}
