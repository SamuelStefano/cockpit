import { useEnrollLink } from './useEnrollLink';

// What happened to the QR link this browser was opened with, if any.
export function EnrollLinkStatus() {
  const { pending, err } = useEnrollLink();
  if (err) {
    return <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12.5px] leading-relaxed text-red-200">{err}</p>;
  }
  if (!pending) return null;
  return (
    <p className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-[12.5px] leading-relaxed text-orange-200" role="status">
      Conectando este aparelho pelo QR…
    </p>
  );
}
