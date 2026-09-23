import { useState, type FormEvent } from 'react';
import { MAX_DRAFT_POINTS } from '../../../shared/dfl-drafts';

// Inline "nova task" row of a delivery: title + points, Enter adds and keeps the
// focus there so several tasks go in a row.
export function useAddTask(onAdd: (title: string, points: number) => void) {
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const n = Number(points.replace(',', '.'));
  const valid = title.trim() !== '' && points.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= MAX_DRAFT_POINTS;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onAdd(title.trim(), n);
    setTitle('');
    setPoints('');
  };
  return { title, setTitle, points, setPoints, valid, submit };
}
