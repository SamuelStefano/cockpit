// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RepoSource } from './RepoSource';

afterEach(cleanup);

const base = { path: 'maria', bot: null, onRepo: vi.fn(), onPath: vi.fn() };

describe('RepoSource', () => {
  it('warns that a restricted agent never runs in the repo folder', () => {
    render(<RepoSource {...base} repo="a/b" restricted />);
    expect(screen.getByText(/Ligue "Escrever"/)).toBeTruthy();
  });
  it('stays quiet without a repo or with write on', () => {
    render(<RepoSource {...base} repo="" restricted />);
    render(<RepoSource {...base} repo="a/b" />);
    expect(screen.queryByText(/Ligue "Escrever"/)).toBeNull();
  });
});
