import { useState, useEffect, useRef } from 'react';
import type { Session } from '../../data/mock';

interface UseSessionRowArgs {
  s: Session;
  onAddTag?: (id: string, tag: string) => void;
  onRename: (id: string, title: string) => void;
  onDescribe?: (id: string, summary: string) => void;
}

export function useSessionRow({ s, onAddTag, onRename, onDescribe }: UseSessionRowArgs) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.title);
  const [descEditing, setDescEditing] = useState(false);
  const [descDraft, setDescDraft] = useState(s.summary || '');
  const [tagging, setTagging] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const rowRef = useRef<HTMLDivElement>(null);
  const wasInlineEditing = useRef(false);

  // Fechar a edição inline (Esc/Enter) desmonta o input e o foco cai pro body;
  // devolve pro card. Só quando caiu pro body — clique em outro lugar (blur que
  // também fecha) não deve ter o foco roubado.
  useEffect(() => {
    if (editing || descEditing || tagging) { wasInlineEditing.current = true; return; }
    if (!wasInlineEditing.current) return;
    wasInlineEditing.current = false;
    if (document.activeElement === document.body) rowRef.current?.focus();
  }, [editing, descEditing, tagging]);

  const commitTag = () => {
    const v = tagDraft.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24);
    if (v && onAddTag) onAddTag(s.id, v);
    setTagDraft('');
    setTagging(false);
  };

  const commit = () => {
    const v = draft.trim();
    if (v) onRename(s.id, v); else setDraft(s.title);
    setEditing(false);
  };

  // Descrição: vazio é válido (limpa o override e volta ao resumo IA/snippet).
  const commitDesc = () => {
    if (onDescribe) onDescribe(s.id, descDraft.trim());
    setDescEditing(false);
  };

  return {
    editing, setEditing,
    draft, setDraft,
    descEditing, setDescEditing,
    descDraft, setDescDraft,
    tagging, setTagging,
    tagDraft, setTagDraft,
    rowRef,
    commit, commitDesc, commitTag,
  };
}
