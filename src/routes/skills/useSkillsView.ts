import { useEffect, useMemo, useRef, useState } from 'react';
import type { RegistryCatalog, SkillMeta } from '../../../shared/protocol';
import { discoverSkills, matchesQuery, organizeInstalled, packView } from '../../lib/skill-packs';

export type SkillsTab = 'installed' | 'packs' | 'discover';

export function useSkillsView(skills: SkillMeta[], registry: RegistryCatalog | null) {
  const [tab, setTab] = useState<SkillsTab>('installed');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const installedIds = useMemo(() => new Set(skills.map((s) => s.id)), [skills]);

  const installed = useMemo(() => {
    const { packs, groups } = organizeInstalled(skills.filter((s) => matchesQuery(s, query)), registry);
    return { packs, groups: groups.filter((g) => g.items.length) };
  }, [skills, registry, query]);

  const packs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (registry?.packs ?? [])
      .filter((p) => !q || `${p.name} ${p.description} ${p.members.map((m) => m.slug).join(' ')}`.toLowerCase().includes(q))
      .map((p) => packView(p, installedIds, registry));
  }, [registry, installedIds, query]);

  const discover = useMemo(() => discoverSkills(registry, installedIds, query), [registry, installedIds, query]);

  const counts = {
    installed: skills.length,
    packs: registry?.packs.length,
    discover: registry ? discoverSkills(registry, installedIds, '').length : undefined,
  };

  return { tab, setTab, query, setQuery, searchRef, installed, packs, discover, counts };
}
