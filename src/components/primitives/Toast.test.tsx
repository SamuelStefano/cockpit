// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Toaster } from './Toast';

afterEach(cleanup);

describe('Toaster', () => {
  it('hugs the bottom edge by default', () => {
    render(<Toaster />);
    const region = screen.getByRole('status');
    expect(region.className).toContain('bottom-0');
    expect(region.className).not.toContain('3.125rem');
  });

  it('lifts above the phone tab bar and stays flush on desktop', () => {
    render(<Toaster aboveTabBar />);
    const region = screen.getByRole('status');
    expect(region.className).toContain('max-lg:bottom-[3.125rem]');
    expect(region.className).toContain('lg:bottom-0');
  });
});
