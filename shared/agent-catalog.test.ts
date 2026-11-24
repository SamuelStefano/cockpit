import { describe, expect, it } from 'vitest';
import { DEPARTMENTS } from './departments';
import { AGENT_CATALOG, catalogByDepartment, catalogEntry, hireDrafts } from './agent-catalog';
import { validateBotInput } from './team';

const counter = () => { let n = 0; return () => `a${String(++n).padStart(5, '0')}`; };
const bot = (id: string, name: string, label: string) => ({ id, name, label });

describe('catalog', () => {
  it('has 18 entries with unique ids and resolvable leads', () => {
    expect(AGENT_CATALOG).toHaveLength(18);
    expect(new Set(AGENT_CATALOG.map((e) => e.id)).size).toBe(18);
    for (const e of AGENT_CATALOG) if (e.reportsTo) expect(catalogEntry(e.reportsTo)).toBeTruthy();
  });

  it('groups by department in DEPARTMENTS order', () => {
    const groups = catalogByDepartment();
    const order = DEPARTMENTS.map((d) => d.id);
    expect(groups.map((g) => g.department.id)).toEqual(order.filter((id) => AGENT_CATALOG.some((e) => e.department === id)));
    expect(groups.flatMap((g) => g.entries)).toHaveLength(18);
  });
});

describe('hireDrafts', () => {
  it('produces drafts that all pass validateBotInput for the whole catalog', () => {
    const drafts = hireDrafts(AGENT_CATALOG, [], ['spec-driven', 'complex-plan'], counter());
    expect(drafts).toHaveLength(18);
    for (const d of drafts) expect(validateBotInput(d)).toMatchObject({ ok: true });
    expect(new Set(drafts.map((d) => d.name.toLowerCase())).size).toBe(18);
  });

  it('puts every lead before its reports and links them by new id', () => {
    const drafts = hireDrafts(AGENT_CATALOG, [], [], counter());
    const seen = new Set<string>();
    for (const d of drafts) {
      if (d.parentId) expect(seen.has(d.parentId)).toBe(true);
      seen.add(d.id);
    }
    const support = drafts.find((d) => d.label === catalogEntry('support')!.name)!;
    expect(support.parentId).toBe(drafts.find((d) => d.label === catalogEntry('ops')!.name)!.id);
  });

  it('orders a reverse-listed pair lead first', () => {
    const ids = counter();
    const drafts = hireDrafts([catalogEntry('tech-lead')!, catalogEntry('cto')!], [], [], ids);
    expect(drafts.map((d) => d.label)).toEqual(['CTO', 'Tech Lead']);
    expect(drafts[1].parentId).toBe(drafts[0].id);
  });

  it('derives a space-free unique name, case-insensitively against the team', () => {
    const e = [catalogEntry('tech-lead')!];
    expect(hireDrafts(e, [], [], counter())[0].name).toBe('Tech-Lead');
    expect(hireDrafts(e, [bot('x0001', 'tech-lead', 'x')], [], counter())[0].name).toBe('Tech-Lead-2');
    expect(hireDrafts(e, [bot('x0001', 'TECH-LEAD', 'x'), bot('x0002', 'tech-lead-2', 'y')], [], counter())[0].name).toBe('Tech-Lead-3');
  });

  it('uses the shape and department colour, full profile, verbatim instructions', () => {
    const e = catalogEntry('cto')!;
    const [d] = hireDrafts([e], [], [], counter());
    expect(d).toMatchObject({ label: 'CTO', department: 'engineering', profile: 'full', instructions: e.instructions, mascot: { shape: e.shape, color: '#3b82f6' } });
  });

  it('keeps only installed skills and omits the field when none remain', () => {
    const e = catalogEntry('cto')!;
    expect(hireDrafts([e], [], ['spec-driven', 'nope'], counter())[0].skills).toEqual(['spec-driven']);
    expect('skills' in hireDrafts([e], [], ['nope'], counter())[0]).toBe(false);
  });

  it('attaches to an existing team lead by label when the lead is not in the batch', () => {
    const e = [catalogEntry('tech-lead')!];
    expect(hireDrafts(e, [bot('boss1', 'Chefe', 'cto')], [], counter())[0].parentId).toBe('boss1');
    expect(hireDrafts(e, [], [], counter())[0].parentId).toBeUndefined();
  });
});
