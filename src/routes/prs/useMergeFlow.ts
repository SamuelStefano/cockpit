import { useCallback, useState } from 'react';
import { mergeConfirmText, needsMergeConfirm, type PrSummary } from '../../../shared/prs';
import { toast } from '../../components/primitives/toast-bus';
import { mergePr, requestPrs } from './prs-bus';

export function useMergeFlow(pr: PrSummary) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const needsConfirm = needsMergeConfirm(pr);
  const expected = mergeConfirmText(pr);
  const canConfirm = !busy && (!needsConfirm || typed.trim() === expected);

  const start = useCallback(() => { setTyped(''); setOpen(true); }, []);
  const cancel = useCallback(() => { if (!busy) setOpen(false); }, [busy]);

  const confirm = useCallback(async () => {
    if (!canConfirm) return;
    setBusy(true);
    const r = await mergePr(pr.url, needsConfirm ? typed.trim() : undefined);
    setBusy(false);
    if (r.ok) {
      setOpen(false);
      toast(r.message ?? `${expected} mergeada`);
      requestPrs(true);
    } else {
      toast(r.message ?? 'Não deu pra mergear', { tone: 'error', durationMs: 8000 });
    }
  }, [canConfirm, pr.url, needsConfirm, typed, expected]);

  return { open, typed, setTyped, busy, needsConfirm, expected, canConfirm, start, cancel, confirm };
}
