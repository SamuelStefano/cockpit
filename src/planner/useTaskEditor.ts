import { useCallback, useState, type KeyboardEvent } from 'react';
import { PLANNER_LIMITS, PLANNER_REF_RE, type PlannerTask } from '../../shared/planner';
import { useEscapeLayer } from '../components/primitives/useEscapeLayer';

export const isHttpUrl = (v: string): boolean => /^https?:\/\/\S+$/i.test(v.trim());

// Empty strings (not omitted keys) so the server clears a removed tag or ref
// instead of keeping the previous value.
export function finalizeDraft(d: PlannerTask): PlannerTask {
  const ref = (d.ref ?? '').trim();
  return {
    ...d,
    title: d.title.trim(),
    tag: (d.tag ?? '').trim().slice(0, PLANNER_LIMITS.tag),
    ref: PLANNER_REF_RE.test(ref) ? ref : '',
    links: d.links.filter((l) => isHttpUrl(l.url)).map((l) => ({ ...l, url: l.url.trim() })),
  };
}

export function useTaskEditor(task: PlannerTask, onSave: (t: PlannerTask) => void, onBack: () => void) {
  const [draft, setDraft] = useState(task);
  const patch = useCallback((p: Partial<PlannerTask>) => setDraft((d) => ({ ...d, ...p })), []);
  const valid = draft.title.trim() !== '';
  const refInvalid = !!draft.ref?.trim() && !PLANNER_REF_RE.test(draft.ref.trim());
  const save = useCallback(() => {
    if (!valid || refInvalid) return;
    onSave(finalizeDraft(draft));
    onBack();
  }, [valid, refInvalid, draft, onSave, onBack]);
  useEscapeLayer(true, onBack);
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
  }, [save]);
  return { draft, patch, valid: valid && !refInvalid, refInvalid, save, onKeyDown };
}
