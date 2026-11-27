// Tiny count chip shown inside the composer box while focus mode hides the queue,
// attachments and notices.
export function FocusSummary({ queued, attachments }: { queued: number; attachments: number }) {
  const parts = [queued > 0 && `${queued} na fila`, attachments > 0 && `${attachments} ${attachments === 1 ? 'anexo' : 'anexos'}`].filter(Boolean);
  if (parts.length === 0) return null;
  return <span className="fade-up mb-1 ml-2.5 inline-flex h-6 items-center rounded-full bg-neutral-800 px-2.5 text-[12px] text-neutral-400">{parts.join(' · ')}</span>;
}
