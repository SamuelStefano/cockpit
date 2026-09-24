// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { SkillModal } from './SkillModal';

afterEach(cleanup);

const body = '---\nname: deck-ops\ndescription: >-\n  Runbook do Deck\n  quando algo cai.\n---\n\n# Deck ops\n\nPasso a passo.';

describe('SkillModal', () => {
  it('reads the SKILL.md without its YAML frontmatter', () => {
    const { container } = render(<SkillModal doc={{ id: 'deck-ops', name: 'deck-ops', body }} onClose={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Passo a passo.');
    expect(text).not.toContain('description:');
    expect(text).not.toContain('---');
  });

  it('the raw view still shows the whole file', () => {
    render(<SkillModal doc={{ id: 'deck-ops', name: 'deck-ops', body }} onClose={() => {}} />);
    fireEvent.click(screen.getByTitle('cru'));
    expect(document.querySelector('pre')?.textContent).toBe(body);
  });
});
