// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DocSections } from './sections';
import { SECTIONS } from '../docs-data';

afterEach(cleanup);

describe('manual navigation', () => {
  it('lists every rendered section, and every listed section exists', () => {
    const { container } = render(<DocSections year={2026} />);
    const rendered = Array.from(container.querySelectorAll('section[id]')).map((s) => s.id);
    const listed = SECTIONS.map((s) => s.id);
    expect(rendered.filter((id) => !listed.includes(id))).toEqual([]);
    expect(listed.filter((id) => !rendered.includes(id))).toEqual([]);
  });
});
