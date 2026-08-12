import { useState, useRef, useEffect } from 'react';
import type { PointsEntry } from '../../../shared/protocol';

interface Args {
  entry: PointsEntry;
  onCorrect: (entryId: string, points: number) => void;
  onNote: (entryId: string, description: string) => void;
  onDelete: (entryId: string) => void;
}

export function usePointsCard({ entry, onCorrect, onNote, onDelete }: Args) {
  const [editPts, setEditPts] = useState(false);
  const [ptsDraft, setPtsDraft] = useState(String(entry.points));
  const [editDesc, setEditDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(entry.description ?? '');
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const savePts = () => {
    const n = Number(ptsDraft);
    setEditPts(false);
    if (Number.isFinite(n) && n >= 0 && n <= 100_000 && n !== entry.points) onCorrect(entry.entryId, n);
    else setPtsDraft(String(entry.points));
  };
  const saveDesc = () => {
    setEditDesc(false);
    const v = descDraft.trim();
    if (v !== (entry.description ?? '')) onNote(entry.entryId, v);
  };
  const clickDelete = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (confirmDelete) { setConfirmDelete(false); onDelete(entry.entryId); return; }
    setConfirmDelete(true);
    confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
  };

  return {
    editPts, ptsDraft, setPtsDraft, savePts,
    startEditPts: () => { setPtsDraft(String(entry.points)); setEditPts(true); },
    cancelPts: () => { setPtsDraft(String(entry.points)); setEditPts(false); },
    editDesc, descDraft, setDescDraft, saveDesc,
    startEditDesc: () => { setDescDraft(entry.description ?? ''); setEditDesc(true); },
    cancelDesc: () => { setDescDraft(entry.description ?? ''); setEditDesc(false); },
    showHistory, toggleHistory: () => setShowHistory((v) => !v),
    confirmDelete, clickDelete,
  };
}
