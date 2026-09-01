import { useEffect, type ReactNode } from 'react';
import { Button, Icon, type IconName } from '../components/primitives';

// Modal de confirmação para ações destrutivas/sensíveis do painel admin (remover
// token, tirar MCP, conceder/revogar admin). Enter confirma, Esc cancela. Tom
// vermelho por padrão (destrutivo); `tone="accent"` para ações não-destrutivas.
export function AdminConfirm({
  heading, body, cta, icon = 'trash', tone = 'danger', onConfirm, onCancel,
}: {
  heading: string;
  body: ReactNode;
  cta: string;
  icon?: IconName;
  tone?: 'danger' | 'accent';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onCancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  const glyph = tone === 'danger' ? 'bg-red-500/15 text-red-400' : 'bg-orange-500/15 text-orange-400';

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label={heading} className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${glyph}`}>
            <Icon name={icon} size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-neutral-100">{heading}</p>
            <p className="mt-1 text-[12px] leading-snug text-neutral-400">{body}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant={tone === 'danger' ? 'dangerSolid' : 'primary'} onClick={onConfirm}>{cta}</Button>
        </div>
      </div>
    </div>
  );
}
