import { useState } from 'react';
import type { SkillMeta } from '../../../shared/protocol';
import { exportTemplate, parseTemplate, templateToDraft, templateToJson, templateToLink, type ImportedDraft } from '../../../shared/agent-template';
import type { BotDraft } from './useBotForm';

export type CopyState = 'idle' | 'link' | 'json';

export interface TemplateSource {
  draft: BotDraft;
  skills: SkillMeta[];
}

export function exportPayloads(d: BotDraft, origin: string): { ok: true; link: string; json: string } | { ok: false; error: string } {
  const r = exportTemplate({ name: d.name, label: d.label, instructions: d.instructions, mascot: { shape: d.shape, color: d.color }, skills: d.skills });
  if (!r.ok) return r;
  return { ok: true, link: templateToLink(r.template, origin), json: templateToJson(r.template) };
}

export function importDraft(text: string, skills: SkillMeta[]): { ok: true; draft: ImportedDraft } | { ok: false; error: string } {
  const r = parseTemplate(text);
  if (!r.ok) return r;
  return { ok: true, draft: templateToDraft(r.template, new Set(skills.map((s) => s.id))) };
}

export function useBotTemplate({ draft, skills }: TemplateSource) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopyState>('idle');
  const payload = exportPayloads(draft, typeof window === 'undefined' ? '' : window.location.origin);
  const exportError = draft.name.trim() ? (payload.ok ? null : payload.error) : 'dê um nome ao agente antes de compartilhar';

  const copy = async (kind: 'link' | 'json') => {
    if (!payload.ok || exportError) return;
    try {
      await navigator.clipboard.writeText(kind === 'link' ? payload.link : payload.json);
      setCopied(kind);
    } catch { setError('não consegui copiar — selecione e copie à mão'); }
  };

  const read = () => {
    const r = importDraft(text, skills);
    if (!r.ok) { setError(r.error); return null; }
    setError(null);
    return r.draft;
  };

  return { text, setText: (v: string) => { setText(v); setError(null); }, error, copied, exportError, copy, read };
}
