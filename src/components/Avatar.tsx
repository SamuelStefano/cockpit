import { useEffect, useRef, useState } from 'react';
import { Icon } from './primitives';
import { usePersisted } from '../lib/persist';
import { initials } from './avatar.initials';
import { AI_AVATAR_KEY, AI_AVATAR_DEFAULT, AI_AVATARS, findAiAvatar } from './aiAvatar';

// Avatares do chat. O do Claude é configurável (burst laranja da marca por padrão,
// ou um emoji divertido escolhido no menu de perfil). O do usuário também: clicar
// abre seletor de imagem, reduzida pra 96px e salva como data URL no localStorage
// (sem backend). Shift+clique limpa. Sem imagem → iniciais do nome, senão pessoa.

export function ClaudeAvatar({ size = 28 }: { size?: number }) {
  const [id] = usePersisted<string>(AI_AVATAR_KEY, AI_AVATAR_DEFAULT);
  const preset = findAiAvatar(id);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-neutral-950 shadow-sm shadow-orange-500/25"
      style={{ width: size, height: size, background: preset.bg }}
    >
      {preset.emoji ? (
        <span style={{ fontSize: Math.round(size * 0.56), lineHeight: 1 }}>{preset.emoji}</span>
      ) : (
        <Icon name="claude" size={Math.round(size * 0.52)} stroke={2.2} />
      )}
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

// Avatar do usuário no chat: SÓ exibe (não troca a imagem ao clicar). A troca de
// avatar vive no menu de perfil do header — clicar na bolha do chat não deve
// abrir seletor de imagem (pedido do Samuel).
export function UserAvatar({ size = 28 }: { size?: number }) {
  const [avatar] = usePersisted<string>('user.avatar', '');
  const [name] = usePersisted<string>('user.name', '');
  const init = initials(name);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300"
      style={{ width: size, height: size }}
    >
      {avatar ? (
        <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
      ) : init ? (
        <span className="font-semibold" style={{ fontSize: Math.round(size * 0.4) }}>{init}</span>
      ) : (
        <Icon name="user" size={Math.round(size * 0.5)} />
      )}
    </span>
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
  const [aiIcon, setAiIcon] = usePersisted<string>(AI_AVATAR_KEY, AI_AVATAR_DEFAULT);
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

          <div className="mt-3 border-t border-neutral-800 pt-3">
            <button
              onClick={() => setIconOpen((o) => !o)}
              className="flex w-full items-center gap-2 text-left text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
            >
              <ClaudeAvatar size={18} />
              <span className="flex-1">Ícone da IA</span>
              <Icon name={iconOpen ? 'chevronDown' : 'chevronRight'} size={13} />
            </button>
            {iconOpen && (
              <div className="scroll-thin mt-2 grid max-h-40 grid-cols-6 gap-1.5 overflow-y-auto">
                {AI_AVATARS.map((a) => {
                  const on = a.id === aiIcon;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAiIcon(a.id)}
                      title={a.label}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-neutral-950 transition ${on ? 'ring-2 ring-orange-400 ring-offset-1 ring-offset-neutral-900' : 'hover:scale-110'}`}
                      style={{ background: a.bg }}
                    >
                      {a.emoji ? <span style={{ fontSize: 15, lineHeight: 1 }}>{a.emoji}</span> : <Icon name="claude" size={15} stroke={2.2} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
