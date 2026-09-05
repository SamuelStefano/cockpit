// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SessionGroup } from './SessionGroup';
import { RUNNING_LABEL, WAITING_LABEL } from './group-by-recency';

afterEach(cleanup);

describe('SessionGroup', () => {
  it('envolve o grupo de aguardando num bloco violeta nomeado', () => {
    render(<SessionGroup label={WAITING_LABEL} count={2}><div>linha</div></SessionGroup>);
    const box = screen.getByLabelText(WAITING_LABEL);
    expect(box.className).toContain('border-violet-500/25');
    expect(box.querySelector('div')).toBeTruthy();
  });

  it('tinge o grupo de rodando de verde', () => {
    render(<SessionGroup label={RUNNING_LABEL} count={1}><div /></SessionGroup>);
    expect(screen.getByLabelText(RUNNING_LABEL).className).toContain('border-green-500/20');
  });

  it('grupo de data segue sem caixa', () => {
    const { container } = render(<SessionGroup label="Hoje" count={1}><div /></SessionGroup>);
    expect(container.querySelector('section')).toBeNull();
  });
});
