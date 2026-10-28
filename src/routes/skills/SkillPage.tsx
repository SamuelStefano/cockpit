import { Badge, Button, EmptyState, Icon, Markdown, RiskBadge, SectionTitle, SkeletonCards } from '../../components/primitives';
import { toast } from '../../components/primitives/toast-bus';
import { stripFrontmatter } from '../../../shared/frontmatter';
import type { SkillMeta, TeamBot } from '../../../shared/protocol';
import type { SkillDoc } from '../../useCockpit';
import { botRunsSkill } from '../../../shared/bot-access';
import { risksOf, sourceLabel, sourceOf } from '../../lib/skill-view';
import { UsedBy } from './UsedBy';

interface Props {
  skill: SkillMeta | undefined;
  doc: SkillDoc | null;
  skillId: string;
  bots: TeamBot[];
  loaded: boolean;
  onBack: () => void;
  onToggleAgent?: (skillId: string, botId: string, on: boolean) => void;
}

function Detail({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-neutral-500">{k}</dt>
      <dd className={`min-w-0 break-words text-neutral-200 ${mono ? 'font-mono text-[12px]' : ''}`}>{v}</dd>
    </>
  );
}

export function SkillPage({ skill, doc, skillId, bots, loaded, onBack, onToggleAgent }: Props) {
  if (loaded && !skill) {
    return (
      <EmptyState icon="search" title="Skill não encontrada" description="Ela pode ter sido removida desta máquina.">
        <Button icon="chevronLeft" onClick={onBack}>Voltar para Skills</Button>
      </EmptyState>
    );
  }
  const body = doc && doc.id === skillId ? doc.body : null;
  const title = skill?.name ?? skillId;
  return (
    <div className="mx-auto w-full max-w-240">
      <nav className="mb-2.5 flex items-center gap-1.5 text-[13px] text-neutral-500" aria-label="Trilha">
        <button type="button" onClick={onBack} className="text-neutral-400 hover:text-neutral-200">Skills</button>
        <Icon name="chevronRight" size={12} />
        <span className="truncate">{title}</span>
      </nav>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-neutral-100">{title}</h1>
        {skill && risksOf(skill).map((r) => <RiskBadge key={r} risk={r} />)}
        {skill && <Badge>{sourceLabel(sourceOf(skill))}</Badge>}
        {body && (
          <Button className="ml-auto" variant="ghost" size="sm" icon="copy" aria-label="Copiar SKILL.md"
            onClick={() => { void navigator.clipboard?.writeText(body); toast('SKILL.md copiado'); }}>Copiar</Button>
        )}
      </div>
      {skill?.description && <p className="mb-5 max-w-3xl text-[14px] text-neutral-400">{skill.description}</p>}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <SectionTitle>O que ela faz (SKILL.md)</SectionTitle>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4.5 py-4">
            {body === null ? <SkeletonCards /> : <Markdown md={stripFrontmatter(body)} />}
          </div>
        </div>
        <div className="min-w-0">
          <SectionTitle>Usada por</SectionTitle>
          <UsedBy skillId={skillId} bots={bots} usedBy={bots.filter((b) => botRunsSkill(b, skillId)).map((b) => b.id)} onToggle={onToggleAgent && ((botId, on) => onToggleAgent(skillId, botId, on))} />
          <SectionTitle>Detalhes</SectionTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-3 text-[13px]">
            <Detail k="Fonte" v={skill ? sourceLabel(sourceOf(skill)) : '—'} />
            <Detail k="Pasta" v={`~/.claude/skills/${skillId}`} mono />
            {skill && <Detail k="Atualizada" v={new Date(skill.mtime).toLocaleDateString('pt-BR')} />}
          </dl>
        </div>
      </div>
    </div>
  );
}
