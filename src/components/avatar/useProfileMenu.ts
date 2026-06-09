import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../../lib/profile';
import { downscale } from './downscale';

export function useProfileMenu(userId?: string) {
  const profile = useProfile(userId);
  const [open, setOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    downscale(file).then(profile.setAvatar).catch(() => {});
  };

  return { ...profile, open, setOpen, iconOpen, setIconOpen, fileRef, wrapRef, onFile };
}
