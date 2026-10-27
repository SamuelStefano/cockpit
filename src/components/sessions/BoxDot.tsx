export function BoxDot({ online }: { online: boolean }) {
  return (
    <span
      role="img" aria-label={online ? 'online' : 'offline'} title={online ? 'online' : 'offline'}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${online ? 'bg-green-500' : 'bg-neutral-600'}`}
    />
  );
}
