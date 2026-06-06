import { useEffect, useRef, useState } from 'react';
import { Icon } from './primitives';
import { usePersisted } from '../lib/persist';

// Avatares do chat. O do Claude é um burst laranja (marca própria, não o ícone
// genérico sparkles). O do usuário é configurável: clicar abre seletor de imagem,
// que é reduzida pra 96px e salva como data URL no localStorage (sem backend).
// Shift+clique limpa. Sem imagem → iniciais do nome salvo, senão ícone de pessoa.

export function ClaudeAvatar({ size = 28 }: { size?: number }) {
  const icon = Math.round(size * 0.52);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-neutral-950 shadow-sm shadow-orange-500/25"
      style={{ width: size, height: size, background: 'radial-gradient(circle at 32% 28%, #fb923c, #ea580c)' }}
    >
      <Icon name="claude" size={icon} stroke={2.2} />
    </div>
  );
}

// Reduz a imagem escolhida pro lado máximo de 96px e devolve um data URL leve.
function downscale(file: File, max = 96): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function UserAvatar({ size = 28 }: { size?: number }) {
  const [avatar, setAvatar] = usePersisted<string>('user.avatar', '');
  const [name] = usePersisted<string>('user.name', '');
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (e: React.MouseEvent) => {
    if (e.shiftKey && avatar) { setAvatar(''); return; }
    fileRef.current?.click();
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    downscale(file).then(setAvatar).catch(() => {});
  };

  const init = initials(name);
  const title = avatar ? 'Trocar avatar (shift+clique limpa)' : 'Clique para definir seu avatar';
  return (
    <button
      onClick={pick}
      title={title}
      className="group relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 transition hover:border-orange-500/60"
      style={{ width: size, height: size }}
    >
      {avatar ? (
        <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
      ) : init ? (
        <span className="font-semibold" style={{ fontSize: Math.round(size * 0.4) }}>{init}</span>
      ) : (
        <Icon name="user" size={Math.round(size * 0.5)} />
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
    </button>
  );
}

// Face não-interativa do avatar (sem file picker): usada como gatilho do menu de
// perfil no header, onde o clique abre o popover em vez de escolher imagem.
function AvatarFace({ avatar, name, size }: { avatar: string; name: string; size: number }) {
  const init = initials(name);
  return (
    <span
      className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {avatar ? (
        <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
      ) : init ? (
        <span className="font-semibold text-neutral-200" style={{ fontSize: Math.round(size * 0.4) }}>{init}</span>
      ) : (
        <Icon name="user" size={Math.round(size * 0.5)} />
      )}
    </span>
  );
}

// Menu de perfil no header: define nome (usado nas iniciais do chat) e faz
// upload/limpa o avatar. Tudo local (data URL no localStorage), sem backend.
export function ProfileMenu() {
  const [avatar, setAvatar] = usePersisted<string>('user.avatar', '');
  const [name, setName] = usePersisted<string>('user.name', '');
  const [open, setOpen] = useState(false);
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
    downscale(file).then(setAvatar).catch(() => {});
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Perfil"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 transition hover:border-orange-500/60"
      >
        <AvatarFace avatar={avatar} name={name} size={32} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-950">
              <AvatarFace avatar={avatar} name={name} size={40} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-neutral-200">{name || 'Sem nome'}</p>
              <p className="text-[11px] text-neutral-500">Perfil local</p>
            </div>
          </div>
          <label className="mt-3 block text-[11px] font-medium text-neutral-500">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[12.5px] text-neutral-200 outline-none transition focus:border-orange-500/40"
          />
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[12px] text-neutral-300 transition hover:border-neutral-700"
            >
              <Icon name="paperclip" size={12} /> Trocar imagem
            </button>
            {avatar && (
              <button
                onClick={() => setAvatar('')}
                className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[12px] text-neutral-400 transition hover:border-red-500/40 hover:text-red-300"
              >
                Limpar
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        </div>
      )}
    </div>
  );
}
