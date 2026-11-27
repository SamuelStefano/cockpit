import { useEffect } from 'react';
import { toast } from '../../components/primitives';

type AdminOp = { ok: boolean; message: string } | null;

// adminOp lives in app state for 4–8s: leaving a section and coming back inside
// that window would toast the same result twice.
const toasted = new WeakSet<object>();

export function useAdminOpToast(adminOp: AdminOp) {
  useEffect(() => {
    if (!adminOp || toasted.has(adminOp)) return;
    toasted.add(adminOp);
    toast(adminOp.message, { tone: adminOp.ok ? 'ok' : 'error' });
  }, [adminOp]);
}
