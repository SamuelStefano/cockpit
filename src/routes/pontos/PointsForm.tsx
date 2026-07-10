import { useState } from 'react';
import { Button, Input } from '../../components/primitives';

interface Props {
  onAdd: (title: string, points: number, description?: string) => void;
  onCancel: () => void;
}

// Form inline de adição manual (o caminho normal é o agente registrar). Título +
// pontos obrigatórios; descrição opcional.
export function PointsForm({ onAdd, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const [description, setDescription] = useState('');

  const pts = Number(points);
  const valid = title.trim().length > 0 && points.trim() !== '' && Number.isFinite(pts) && pts >= 0 && pts <= 100_000;

  const submit = () => {
    if (!valid) return;
    onAdd(title.trim(), pts, description.trim() || undefined);
    onCancel();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <div className="mb-4 rounded-xl border border-orange-500/40 bg-neutral-900/50 p-3 glow-active" onKeyDown={onKey}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da task" className="flex-1" />
        <Input value={points} onChange={(e) => setPoints(e.target.value)} placeholder="pts" inputMode="numeric" className="sm:w-24" />
      </div>
      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" className="mt-2" />
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={submit} disabled={!valid}>Registrar</Button>
      </div>
    </div>
  );
}
