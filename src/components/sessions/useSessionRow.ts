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
  const inputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tagging && tagRef.current) tagRef.current.focus();
  }, [tagging]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (descEditing && descRef.current) {
      descRef.current.focus();
      descRef.current.select();
    }
  }, [descEditing]);

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
    inputRef, descRef, tagRef,
    commit, commitDesc, commitTag,
  };
}
