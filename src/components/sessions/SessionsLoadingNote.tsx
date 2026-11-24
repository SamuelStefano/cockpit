import { useEffect, useState } from 'react';
import { Button } from '../primitives';

// Offline the sessions never arrive: say so and offer a retry instead of a
// skeleton that spins forever.
export function SessionsLoadingNote() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online) return <p className="px-1 text-[11.5px] text-neutral-500">Carregando sessões…</p>;
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <p className="text-[12px] text-neutral-400">Sem conexão.</p>
      <Button variant="secondary" size="sm" icon="rotate" onClick={() => window.location.reload()}>Tentar de novo</Button>
    </div>
  );
}
