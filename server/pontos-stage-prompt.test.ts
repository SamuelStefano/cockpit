import { describe, it, expect } from 'vitest';
import { buildStageDraftsPrompt } from './pontos-stage-prompt';

const req = { note: '  thumbify e reviews  ', epicCapCents: 500_000, monthCapCents: 400_000, pointValue: 75 };

describe('buildStageDraftsPrompt', () => {
  it('stages into the Deck through deck-drafts and forbids writing to DFL', () => {
    const p = buildStageDraftsPrompt(req);
    expect(p).toContain("~/bin/deck-drafts import - <<'EOF'");
    expect(p).toContain('NÃO use o MCP dfl-work');
    expect(p).toContain('NÃO gere fatura');
  });

  it('carries the note, both caps and the delivery syntax the importer reads', () => {
    const p = buildStageDraftsPrompt(req);
    expect(p).toContain('thumbify e reviews');
    expect(p).toContain('R$ 5.000,00');
    expect(p).toContain('R$ 4.000,00');
    expect(p).toContain('### <título da delivery>');
  });

  it('without a note, sends the agent to the merged PRs', () => {
    expect(buildStageDraftsPrompt({ ...req, note: '' })).toContain('varra as PRs mergeadas');
  });
});
