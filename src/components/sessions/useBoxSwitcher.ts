import { useMemo, useState } from 'react';
import type { BoxInfo } from '../../../shared/boxes';
import { sanitizeBoxLabel } from '../../../shared/boxes';
import { boxLabel } from '../../cockpit/boxes-store';
import { useBoxes } from '../../cockpit/useBoxes';
import { boxHealthStore, healthLevel } from '../../cockpit/box-health-store';
import { useBoxHealthState } from '../health/useBoxHealthPanel';

export function sortBoxes(boxes: BoxInfo[]): BoxInfo[] {
  return [...boxes].sort((a, b) => Number(b.online) - Number(a.online) || boxLabel(a).localeCompare(boxLabel(b)));
}

export function useBoxSwitcher() {
  const { known, boxes, active, switchBox, renameBox, revokeBox } = useBoxes();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const health = useBoxHealthState();

  const sorted = useMemo(() => sortBoxes(boxes), [boxes]);
  const current = boxes.find((b) => b.id === active) ?? null;

  const startEdit = (b: BoxInfo) => { setConfirmId(null); setEditingId(b.id); setDraft(b.label); };
  const commitEdit = () => {
    if (editingId && sanitizeBoxLabel(draft)) renameBox(editingId, draft);
    setEditingId(null);
  };
  const close = () => { setOpen(false); setEditingId(null); setConfirmId(null); };

  return {
    visible: known && boxes.length >= 1,
    sorted, current, active, open, setOpen, close,
    editingId, draft, setDraft, startEdit, commitEdit, cancelEdit: () => setEditingId(null),
    confirmId, askRevoke: (id: string) => { setEditingId(null); setConfirmId(id); }, cancelRevoke: () => setConfirmId(null),
    revoke: (id: string) => { revokeBox(id); setConfirmId(null); },
    select: (id: string) => { if (id !== active) switchBox(id); close(); },
    levelOf: (id: string) => healthLevel(health.byBox[id]),
    openHealth: () => { close(); boxHealthStore.openPanel(); },
    adding, startAdd: () => { close(); setAdding(true); }, stopAdd: () => setAdding(false),
  };
}
