// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);
import { TopBarAction, TopBarSlotContext } from './TopBarSlot';

describe('TopBarAction', () => {
  it('renders nothing without a slot', () => {
    render(<TopBarAction><button>go</button></TopBarAction>);
    expect(screen.queryByText('go')).toBeNull();
  });

  it('portals into the slot element', () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    render(<TopBarSlotContext.Provider value={slot}><TopBarAction><button>go</button></TopBarAction></TopBarSlotContext.Provider>);
    expect(slot.textContent).toBe('go');
  });
});
