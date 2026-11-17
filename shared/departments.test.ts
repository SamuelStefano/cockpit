import { describe, expect, it } from 'vitest';
import { DEPARTMENTS, departmentById, groupByDepartment, isDepartmentId } from './departments';

describe('departments catalog', () => {
  it('keeps the catalog order', () => {
    expect(DEPARTMENTS.map((d) => d.id)).toEqual(['direction', 'engineering', 'growth', 'finance', 'operations']);
  });
  it('recognises only known ids', () => {
    expect(isDepartmentId('growth')).toBe(true);
    expect(isDepartmentId('sales')).toBe(false);
    expect(isDepartmentId(3)).toBe(false);
  });
  it('looks a department up by id', () => {
    expect(departmentById('finance')?.name).toBe('Finanças');
    expect(departmentById(undefined)).toBeNull();
  });
});

describe('groupByDepartment', () => {
  const items = [
    { n: 'a', d: 'growth' as const },
    { n: 'b' },
    { n: 'c', d: 'direction' as const },
    { n: 'd', d: 'growth' as const },
  ];
  it('groups in catalog order with the no-department group last', () => {
    const groups = groupByDepartment(items, (i) => i.d);
    expect(groups.map((g) => g.department?.id ?? null)).toEqual(['direction', 'growth', null]);
    expect(groups[1].items.map((i) => i.n)).toEqual(['a', 'd']);
  });
  it('omits empty groups', () => {
    expect(groupByDepartment([], () => undefined)).toEqual([]);
    expect(groupByDepartment([{ n: 'x' }], () => undefined)).toHaveLength(1);
  });
});
