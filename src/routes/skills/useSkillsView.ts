import { useEffect, useMemo, useRef, useState } from 'react';
import type { RegistryCatalog, SkillMeta } from '../../../shared/protocol';
import { discoverSkills, matchesQuery, packView } from '../../lib/skill-packs';
import { filterSkills, sourceChips, type RiskFilter, type SourceFilter } from '../../lib/skill-view';

export type SkillsTab = 'installed' | 'packs' | 'discover';

export function useSkillsView(skills: SkillMeta[], registry: RegistryCatalog | null) {
  const [tab, setTab] = useState<SkillsTab>('installed');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [risk, setRisk] = useState<RiskFilter>('any');
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

  const chips = useMemo(() => sourceChips(skills, registry), [skills, registry]);
  const installed = useMemo(
    () => filterSkills(skills.filter((s) => matchesQuery(s, query)), source, risk, registry),
    [skills, registry, query, source, risk],
  );

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

  return { tab, setTab, query, setQuery, searchRef, chips, source, setSource, risk, setRisk, installed, packs, discover, counts };
}
