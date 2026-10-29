// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { ToggleChip } from './ToggleChip';

afterEach(cleanup);

const chip = () => screen.getByRole('button');

describe('ToggleChip', () => {
  it('marca o estado ligado com o aro interno do acento', () => {
    render(<ToggleChip on icon="sparkles">skills</ToggleChip>);
    expect(chip().className).toContain('rgba(249,115,22,0.4)');
    expect(chip().className).toContain('bg-orange-500/15');
  });

  it('desligado não pinta acento nenhum', () => {
    render(<ToggleChip on={false} icon="sparkles">skills</ToggleChip>);
    expect(chip().className).not.toContain('rgba(249,115,22');
    expect(chip().className).toContain('bg-neutral-950');
  });

  // O bypass roda comando sem aprovação: se o tom vermelho vazasse pro laranja dos
  // pickers, ligado e "ligado e perigoso" ficariam indistinguíveis na mesma barra.
  it('tom danger usa vermelho no fundo, no aro e no foco', () => {
    render(<ToggleChip on tone="danger" icon="shield-off">bypass</ToggleChip>);
    expect(chip().className).toContain('bg-red-500/15');
    expect(chip().className).toContain('rgba(239,68,68,0.4)');
    expect(chip().className).toContain('focus-visible:ring-red-500/40');
  });

  it('é type=button pra não submeter o form do compositor', () => {
    render(<ToggleChip on={false} icon="command">MCP</ToggleChip>);
    expect(chip()).toHaveProperty('type', 'button');
  });

  it('repassa role/aria e onClick pro botão', () => {
    const onClick = vi.fn();
    render(<ToggleChip on role="switch" aria-checked icon="shield" onClick={onClick}>bypass</ToggleChip>);
    const el = screen.getByRole('switch');
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledOnce();
    expect(el.getAttribute('aria-checked')).toBe('true');
  });
});
