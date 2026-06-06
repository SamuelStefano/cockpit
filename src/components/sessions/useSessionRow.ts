import { useState, useEffect, useRef } from 'react';
import type { Session } from '../../data/mock';

interface UseSessionRowArgs {
  s: Session;
  onAddTag?: (id: string, tag: string) => void;
  onRename: (id: string, title: string) => void;
}

export function useSessionRow({ s, onAddTag, onRename }: UseSessionRowArgs) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.title);
  const [tagging, setTagging] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
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

  return {
    editing, setEditing,
    draft, setDraft,
    tagging, setTagging,
    tagDraft, setTagDraft,
    inputRef, tagRef,
    commit, commitTag,
  };
}
