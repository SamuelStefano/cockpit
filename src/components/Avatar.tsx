import { useRef } from 'react';
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
