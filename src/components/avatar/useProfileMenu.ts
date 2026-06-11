import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../../lib/profile';
import { downscale } from './downscale';
import { avatarFileError } from './avatar-file';

export function useProfileMenu(userId?: string) {
  const profile = useProfile(userId);
  const [open, setOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setUploadError(null); return; }
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    // Um Esc fecha um overlay só: ignora keypress já consumido e marca o que consome.
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !e.isComposing) { e.preventDefault(); setOpen(false); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const error = avatarFileError(file.type, file.size);
    if (error) { setUploadError(error); return; }
    setUploadError(null);
    downscale(file).then(profile.setAvatar).catch(() => setUploadError('Não deu pra ler essa imagem.'));
  };

  return { ...profile, open, setOpen, iconOpen, setIconOpen, uploadError, fileRef, wrapRef, onFile };
}
