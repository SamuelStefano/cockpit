import { Bit } from '../components/bit/Bit';

export function RouteFallback() {
  return (
    <div role="status" className="fade-up flex h-full min-h-48 flex-col items-center justify-center gap-1.5">
      <Bit state="thinking" size={40} />
      <span className="font-mono text-[11.5px] text-neutral-500">carregando…</span>
    </div>
  );
}
