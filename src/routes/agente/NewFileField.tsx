import { useState } from 'react';
import { Button, Input } from '../../components/primitives';
import { newFilePath } from './workspace-edit';

interface NewFileFieldProps { exists: (path: string) => boolean; onCreate: (path: string) => void }

export function NewFileField({ exists, onCreate }: NewFileFieldProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!open) return <Button variant="ghost" size="xs" icon="plus" onClick={() => setOpen(true)}>Novo arquivo</Button>;
  const close = () => { setOpen(false); setName(''); setError(null); };
  const submit = () => {
    const path = newFilePath(name);
    if (!path) return setError('Nome inválido. Use letras, pastas com / e termine em .md.');
    if (exists(path)) return setError('Já existe um arquivo com esse nome.');
    onCreate(path);
    close();
  };
  return (
    <form className="flex w-full flex-col gap-1.5 px-2.5 pb-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Input size="sm" mono autoFocus aria-label="Nome do novo arquivo" placeholder="notas.md" value={name} error={!!error}
        onChange={(e) => { setName(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />
      {error && <p role="alert" className="text-[12px] text-red-300">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="xs" onClick={close}>Cancelar</Button>
        <Button variant="primary" size="xs" type="submit">Criar</Button>
      </div>
    </form>
  );
}
