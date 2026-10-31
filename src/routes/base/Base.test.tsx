// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Base } from './Base';
import { savePref } from '../../lib/persist';
import { GAME_ENABLED_KEY } from '../../lib/prefs';
import type { LiveSource } from './useLiveFeed';

vi.mock('./BaseStage', () => ({ BaseStage: () => <div>stage</div> }));
const width = window.innerWidth;
afterEach(() => { window.innerWidth = width; });

describe('Base', () => {
  it('only promises progress on a narrow screen while the game is on', () => {
    window.innerWidth = 1099;
    savePref(GAME_ENABLED_KEY, false);
    render(<Base source={{} as LiveSource} />);
    expect(screen.queryByText(/Your progress is here/)).toBeNull();
    savePref(GAME_ENABLED_KEY, true);
  });
  it('is desktop only below 1100px and never mounts the stage', () => {
    window.innerWidth = 1099;
    render(<Base source={{} as LiveSource} />);
    expect(screen.getByText('Desktop only')).toBeTruthy();
    expect(screen.queryByText('stage')).toBeNull();
  });
  it('mounts the stage on desktop', () => {
    window.innerWidth = 1100;
    render(<Base source={{} as LiveSource} />);
    expect(screen.getByText('stage')).toBeTruthy();
  });
});
