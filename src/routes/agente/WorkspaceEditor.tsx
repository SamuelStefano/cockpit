import type { KeyboardEvent } from 'react';
import { Button } from '../../components/primitives';
import { isBotSettingsPath, parseSettingsText } from '../../../shared/bot-settings';

interface WorkspaceEditorProps {
  path: string;
  text: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function WorkspaceEditor({ path, text, dirty, saving, error, onChange, onSave, onCancel }: WorkspaceEditorProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!saving) onSave(); }
  };
  const parsed = isBotSettingsPath(path) ? parseSettingsText(text) : null;
  const invalid = parsed && !parsed.ok ? `JSON inválido na linha ${parsed.line}` : null;
  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <div className="flex items-center gap-2 border-b border-(--border) px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium text-(--text-strong)" title={path}>
          {path}{dirty && <span aria-label="Alterações não salvas" className="ml-1.5 text-(--accent-soft)">●</span>}
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={onSave} disabled={saving || !dirty || !!invalid} title={invalid ?? undefined}>{saving ? 'Salvando…' : 'Salvar'}</Button>
      </div>
      {parsed && <p className="border-b border-(--border) px-3 py-2 text-[12.5px] text-(--text-muted)">Permissões do agente: mudanças valem no próximo turno.</p>}
      {invalid && <p role="alert" className="border-b border-(--border) px-3 py-2 text-[12.5px] text-red-300">{invalid}</p>}
      {error && <p role="alert" className="border-b border-(--border) px-3 py-2 text-[12.5px] text-red-300">{error}</p>}
      <textarea aria-label={`Editar ${path}`} value={text} spellCheck={false} autoFocus onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
        className="scroll-thin min-h-0 w-full flex-1 resize-none bg-transparent p-3 font-mono text-[12.5px] leading-relaxed text-(--text-body) outline-none" />
    </div>
  );
}
